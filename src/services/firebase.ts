import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  writeBatch 
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject 
} from 'firebase/storage';
import { Patient, MedicalRecord, SearchFilters } from '../types';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Servicio de autenticación
export const authService = {
  signIn: async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  },

  signOut: async () => {
    await firebaseSignOut(auth);
  },

  onAuthStateChanged: (callback: (user: FirebaseUser | null) => void) => {
    return onAuthStateChanged(auth, callback);
  },

  getCurrentUser: () => {
    return auth.currentUser;
  }
};

// Servicio de pacientes
export const patientService = {
  create: async (patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>) => {
    const docRef = await addDoc(collection(db, 'patients'), {
      ...patient,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    return docRef.id;
  },

  update: async (id: string, updates: Partial<Patient>) => {
    const docRef = doc(db, 'patients', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  },

  getAll: async () => {
    const querySnapshot = await getDocs(collection(db, 'patients'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    })) as Patient[];
  }
};

// Servicio de historiales médicos
export const medicalRecordService = {
  create: async (record: Omit<MedicalRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    const docRef = await addDoc(collection(db, 'medicalRecords'), {
      ...record,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    return docRef.id;
  },

  update: async (id: string, updates: Partial<MedicalRecord>) => {
    const docRef = doc(db, 'medicalRecords', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  },

  getAll: async (filters?: SearchFilters) => {
    let q = collection(db, 'medicalRecords');
    
    // Aplicar filtros si existen
    if (filters) {
      const conditions = [];
      
      if (filters.name) {
        conditions.push(where('patientName', '>=', filters.name));
        conditions.push(where('patientName', '<=', filters.name + '\uf8ff'));
      }
      
      if (filters.surname) {
        conditions.push(where('patientSurname', '>=', filters.surname));
        conditions.push(where('patientSurname', '<=', filters.surname + '\uf8ff'));
      }
      
      if (filters.dni) {
        conditions.push(where('patientDni', '==', filters.dni));
      }
      
      if (filters.dateFrom) {
        conditions.push(where('createdAt', '>=', Timestamp.fromDate(filters.dateFrom)));
      }
      
      if (filters.dateTo) {
        conditions.push(where('createdAt', '<=', Timestamp.fromDate(filters.dateTo)));
      }
      
      if (filters.keywords) {
        conditions.push(where('report', '>=', filters.keywords));
        conditions.push(where('report', '<=', filters.keywords + '\uf8ff'));
      }
      
      // Por defecto, no incluir registros eliminados
      if (!filters.includeDeleted) {
        conditions.push(where('deletedAt', '==', null));
      }
      
      if (conditions.length > 0) {
        q = query(q, ...conditions, orderBy('createdAt', 'desc'));
      } else {
        q = query(q, orderBy('createdAt', 'desc'));
      }
    } else {
      // Por defecto, no incluir registros eliminados
      q = query(q, where('deletedAt', '==', null), orderBy('createdAt', 'desc'));
    }
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      deletedAt: doc.data().deletedAt?.toDate()
    })) as MedicalRecord[];
  },

  getById: async (id: string) => {
    const docRef = doc(db, 'medicalRecords', id);
    const docSnap = await getDocs(query(collection(db, 'medicalRecords'), where('__name__', '==', id)));
    
    if (!docSnap.empty) {
      const docData = docSnap.docs[0].data();
      return {
        id: docSnap.docs[0].id,
        ...docData,
        createdAt: docData.createdAt?.toDate(),
        updatedAt: docData.updatedAt?.toDate(),
        deletedAt: docData.deletedAt?.toDate()
      } as MedicalRecord;
    }
    
    return null;
  },

  softDelete: async (id: string) => {
    const docRef = doc(db, 'medicalRecords', id);
    await updateDoc(docRef, {
      deletedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  },

  restore: async (id: string) => {
    const docRef = doc(db, 'medicalRecords', id);
    await updateDoc(docRef, {
      deletedAt: null,
      updatedAt: Timestamp.now()
    });
  },

  delete: async (id: string) => {
    const docRef = doc(db, 'medicalRecords', id);
    await deleteDoc(docRef);
  },

  cleanupOldDeleted: async (daysOld: number = 30) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const q = query(
      collection(db, 'medicalRecords'),
      where('deletedAt', '<=', Timestamp.fromDate(cutoffDate))
    );
    
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    querySnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  }
};

// Servicio de almacenamiento de archivos
export const storageService = {
  uploadFile: async (file: File, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  },

  deleteFile: async (url: string) => {
    try {
      const storageRef = ref(storage, url);
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Error eliminando archivo:', error);
    }
  },

  uploadDocuments: async (files: File[], patientId: string): Promise<string[]> => {
    const uploadPromises = files.map(async (file, index) => {
      const fileName = `documents/${patientId}/${Date.now()}_${index}_${file.name}`;
      return await storageService.uploadFile(file, fileName);
    });
    
    return await Promise.all(uploadPromises);
  }
}; 