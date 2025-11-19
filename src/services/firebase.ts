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
  limit,
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
  // Generar siguiente número de historia (formato MMaann)
  generateNextRecordNumber: async (userId: string): Promise<string> => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Mes: 01-12
    const year = String(now.getFullYear()).slice(-2); // Año: últimos 2 dígitos
    
    const prefix = `${month}${year}`; // Formato: 1125 para noviembre 2025
    
    try {
      // Buscar todos los registros del usuario que tienen recordNumber con el prefijo del mes actual
      // Primero buscar por recordNumber con rango para encontrar todos los números del mes
      const q = query(
        collection(db, 'medicalRecords'),
        where('userId', '==', userId),
        where('recordNumber', '>=', `${prefix}00`),
        where('recordNumber', '<=', `${prefix}99`),
        orderBy('recordNumber', 'desc'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      console.log(`[generateNextRecordNumber] Buscando registros del mes ${prefix} para usuario ${userId}`);
      console.log(`[generateNextRecordNumber] Total de documentos encontrados: ${querySnapshot.size}`);
      
      // Encontrar el último número usado
      let maxNumber = 0;
      
      if (!querySnapshot.empty) {
        const firstDoc = querySnapshot.docs[0];
        const record = firstDoc.data() as MedicalRecord;
        
        console.log(`[generateNextRecordNumber] Registro con número más alto encontrado:`, {
          id: firstDoc.id,
          recordNumber: record.recordNumber,
          createdAt: record.createdAt,
          patientName: record.patientName
        });
        
        if (record.recordNumber && record.recordNumber.startsWith(prefix)) {
          maxNumber = parseInt(record.recordNumber.slice(-2), 10);
          console.log(`[generateNextRecordNumber] Número máximo extraído: ${maxNumber} (de ${record.recordNumber})`);
        }
      } else {
        console.log(`[generateNextRecordNumber] No se encontraron registros con números del mes ${prefix}`);
      }
      
      // Si no hay registros con número asignado, empezar desde 01
      // Generar siguiente número (o 01 si es el primero)
      const nextNumber = maxNumber === 0 ? 1 : maxNumber + 1;
      const sequentialNumber = String(nextNumber).padStart(2, '0');
      
      return `${prefix}${sequentialNumber}`;
      } catch (error) {
        console.error('Error generando número de historia:', error);
        // Si hay error (puede ser por falta de índice), intentar buscar sin ordenar por recordNumber
        try {
          console.log('[generateNextRecordNumber] Intentando fallback sin ordenar por recordNumber...');
          const q = query(
            collection(db, 'medicalRecords'),
            where('userId', '==', userId),
            where('recordNumber', '>=', `${prefix}00`),
            where('recordNumber', '<=', `${prefix}99`)
          );
          const snapshot = await getDocs(q);
          
          // Buscar el número máximo manualmente
          let maxNumber = 0;
          
          if (!snapshot.empty) {
            snapshot.docs.forEach(docSnapshot => {
              const record = docSnapshot.data() as MedicalRecord;
              if (record.recordNumber && record.recordNumber.startsWith(prefix)) {
                const sequentialPart = parseInt(record.recordNumber.slice(-2), 10);
                if (sequentialPart > maxNumber) {
                  maxNumber = sequentialPart;
                  console.log(`[generateNextRecordNumber] Fallback: encontrado número ${sequentialPart} en registro ${docSnapshot.id}`);
                }
              }
            });
          }
          
          const nextNumber = maxNumber === 0 ? 1 : maxNumber + 1;
          const sequentialNumber = String(nextNumber).padStart(2, '0');
          console.log(`[generateNextRecordNumber] Fallback: generando número ${prefix}${sequentialNumber}`);
          return `${prefix}${sequentialNumber}`;
        } catch (fallbackError) {
          console.error('[generateNextRecordNumber] Error en fallback:', fallbackError);
          // Si todo falla, empezar desde 01
          return `${prefix}01`;
        }
      }
  },

  create: async (record: Omit<MedicalRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    console.log('[medicalRecords.create] INICIO - registro recibido:', record);
    
    // Si no tiene número de historia, generarlo
    if (!record.recordNumber && record.userId) {
      console.log('[medicalRecords.create] Generando número de historia...');
      record.recordNumber = await medicalRecordService.generateNextRecordNumber(record.userId);
      console.log('[medicalRecords.create] Número de historia generado:', record.recordNumber);
    }
    
    // Filtrar campos undefined antes de crear el documento
    const cleanRecord = Object.fromEntries(
      Object.entries(record).filter(([_, value]) => value !== undefined)
    );
    
    console.log('[medicalRecords.create] Registro limpio:', cleanRecord);
    console.log('[medicalRecords.create] Intentando crear en colección: medicalRecords');
    
    try {
      const docRef = await addDoc(collection(db, 'medicalRecords'), {
        ...cleanRecord,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      
      console.log('[medicalRecords.create] ✅ Registro creado exitosamente');
      console.log('[medicalRecords.create] ID del documento:', docRef.id);
      console.log('[medicalRecords.create] Ruta completa:', `medicalRecords/${docRef.id}`);
      return docRef.id;
    } catch (error: any) {
      console.error('[medicalRecords.create] ❌ ERROR al crear registro médico');
      console.error('[medicalRecords.create] Código de error:', error?.code);
      console.error('[medicalRecords.create] Mensaje de error:', error?.message);
      console.error('[medicalRecords.create] Error completo:', error);
      throw error;
    }
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

  // Función para borrar todo el historial del usuario actual
  deleteAllRecords: async (userId: string) => {
    try {
      // Obtener solo los registros del usuario actual
      const q = query(
        collection(db, 'medicalRecords'),
        where('userId', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return { deletedCount: 0, message: 'No hay registros para eliminar' };
      }
      
      // Crear batch para eliminar todos los documentos del usuario
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