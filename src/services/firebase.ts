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

// Exportar instancias para uso en otros módulos
export { db, auth, storage };

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
    console.log('[patients.create] INICIO - paciente recibido:', patient);
    const currentUid = auth.currentUser?.uid;
    console.log('[patients.create] currentUid:', currentUid);
    
    const payload: any = {
      ...patient,
      // Asegurar userId si no viene incluido explícitamente
      ...(patient as any).userId ? {} : (currentUid ? { userId: currentUid } : {}),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    console.log('[patients.create] payload final a escribir:', JSON.stringify(payload, null, 2));
    console.log('[patients.create] userId en payload:', payload.userId);
    console.log('[patients.create] currentUid coincide?', payload.userId === currentUid);
    
    try {
      console.log('[patients.create] Intentando addDoc...');
      const docRef = await addDoc(collection(db, 'patients'), payload);
      console.log('[patients.create] ✅ CREADO con id:', docRef.id);
      return docRef.id;
    } catch (err: any) {
      console.error('[patients.create] ❌ ERROR code:', err?.code);
      console.error('[patients.create] ❌ ERROR message:', err?.message);
      console.error('[patients.create] ❌ ERROR completo:', err);
      throw err;
    }
  },

  update: async (id: string, updates: Partial<Patient>) => {
    const docRef = doc(db, 'patients', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  },

  getById: async (id: string) => {
    const docSnap = await getDocs(query(collection(db, 'patients'), where('__name__', '==', id)));
    
    if (!docSnap.empty) {
      const docData = docSnap.docs[0].data();
      return {
        id: docSnap.docs[0].id,
        ...docData,
        createdAt: docData.createdAt?.toDate(),
        updatedAt: docData.updatedAt?.toDate()
      } as Patient;
    }
    
    return null;
  },

  getAll: async (userId: string) => {
    const q = query(
      collection(db, 'patients'),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);
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
    console.log('Creando registro médico:', record);
    
    // Filtrar campos undefined antes de crear el documento
    const cleanRecord = Object.fromEntries(
      Object.entries(record).filter(([_, value]) => value !== undefined)
    );
    
    console.log('Registro limpio:', cleanRecord);
    
    const docRef = await addDoc(collection(db, 'medicalRecords'), {
      ...cleanRecord,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    
    console.log('Registro creado con ID:', docRef.id);
    return docRef.id;
  },

  update: async (id: string, updates: Partial<MedicalRecord>) => {
    // Filtrar campos undefined antes de actualizar
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );
    
    const docRef = doc(db, 'medicalRecords', id);
    await updateDoc(docRef, {
      ...cleanUpdates,
      updatedAt: Timestamp.now()
    });
  },

  getAll: async (userId: string, filters?: SearchFilters) => {
    try {
      // Consulta filtrada por userId directamente en Firestore
      const q = query(
        collection(db, 'medicalRecords'),
        where('userId', '==', userId)
      );
      
      const snapshot = await getDocs(q);
      
      // Convertir documentos y filtrar no eliminados
      const records = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
          deletedAt: doc.data().deletedAt?.toDate()
        })) as MedicalRecord[];
      
      // Filtrar registros no eliminados (a menos que se pida incluir eliminados)
      const activeRecords = filters?.includeDeleted 
        ? records 
        : records.filter(record => !record.deletedAt);
      
      // Ordenar por fecha (más recientes primero)
      return activeRecords.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      console.error('Error en getAll:', error);
      throw error;
    }
  },

  getById: async (id: string, userId: string) => {
    const docSnap = await getDocs(query(collection(db, 'medicalRecords'), where('__name__', '==', id), where('userId', '==', userId)));
    
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

  softDelete: async (id: string, userId: string) => {
    // Verificar que el registro pertenece al usuario antes de eliminarlo
    const record = await medicalRecordService.getById(id, userId);
    if (!record) {
      throw new Error('Registro no encontrado o no tienes permisos para eliminarlo');
    }
    
    const docRef = doc(db, 'medicalRecords', id);
    await updateDoc(docRef, {
      deletedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  },

  restore: async (id: string, userId: string) => {
    // Verificar que el registro pertenece al usuario antes de restaurarlo
    const record = await medicalRecordService.getById(id, userId);
    if (!record) {
      throw new Error('Registro no encontrado o no tienes permisos para restaurarlo');
    }
    
    const docRef = doc(db, 'medicalRecords', id);
    await updateDoc(docRef, {
      deletedAt: null,
      updatedAt: Timestamp.now()
    });
  },

  delete: async (id: string, userId: string) => {
    // Verificar que el registro pertenece al usuario antes de eliminarlo permanentemente
    const record = await medicalRecordService.getById(id, userId);
    if (!record) {
      throw new Error('Registro no encontrado o no tienes permisos para eliminarlo');
    }
    
    const docRef = doc(db, 'medicalRecords', id);
    await deleteDoc(docRef);
  },

  cleanupOldDeleted: async (userId: string, daysOld: number = 30) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    // Consulta simple sin ordenamiento
    const q = query(
      collection(db, 'medicalRecords'),
      where('userId', '==', userId),
      where('deletedAt', '<=', Timestamp.fromDate(cutoffDate))
    );
    
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    querySnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  },

  // Función para administradores: borrar todo el historial
  deleteAllRecords: async () => {
    try {
      // Obtener todos los registros
      const querySnapshot = await getDocs(collection(db, 'medicalRecords'));
      
      if (querySnapshot.empty) {
        return { deletedCount: 0, message: 'No hay registros para eliminar' };
      }
      
      // Crear batch para eliminar todos los documentos
      const batch = writeBatch(db);
      
      querySnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      // Ejecutar el batch
      await batch.commit();
      
      return { 
        deletedCount: querySnapshot.docs.length, 
        message: `Se eliminaron ${querySnapshot.docs.length} registros correctamente` 
      };
    } catch (error) {
      console.error('Error eliminando todos los registros:', error);
      throw new Error(`Error al eliminar todos los registros: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
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