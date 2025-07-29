import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  doc, 
  getDoc, 
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { Patient, MedicalRecord, SearchFilters } from '../types';

export const patientService = {
  async create(patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'patients'), {
      ...patient,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return docRef.id;
  },

  async getAll(): Promise<Patient[]> {
    const querySnapshot = await getDocs(collection(db, 'patients'));
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)
      };
    }) as Patient[];
  },

  async getById(id: string): Promise<Patient | null> {
    const docRef = doc(db, 'patients', id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)
      } as Patient;
    }
    return null;
  },

  async update(id: string, updates: Partial<Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const docRef = doc(db, 'patients', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date()
    });
  }
};

export const medicalRecordService = {
  async create(record: Omit<MedicalRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'medicalRecords'), {
      ...record,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return docRef.id;
  },

  async getAll(includeDeleted: boolean = false): Promise<MedicalRecord[]> {
    try {
      console.log('Iniciando getAll...');
      
      // Consulta simple sin filtros complejos
      const q = query(collection(db, 'medicalRecords'));
      console.log('Query creada');
      
      const querySnapshot = await getDocs(q);
      console.log('QuerySnapshot obtenida, docs:', querySnapshot.docs.length);
      
      const records = querySnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Procesando doc:', doc.id, data);
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
          deletedAt: data.deletedAt?.toDate ? data.deletedAt.toDate() : data.deletedAt ? new Date(data.deletedAt) : undefined
        };
      }) as MedicalRecord[];

      console.log('Registros procesados:', records.length);

      // Filtrar en el cliente para registros no eliminados
      if (!includeDeleted) {
        const filteredRecords = records.filter(record => !record.deletedAt);
        console.log('Registros filtrados (no eliminados):', filteredRecords.length);
        return filteredRecords;
      }

      return records;
    } catch (error) {
      console.error('Error en getAll:', error);
      throw error;
    }
  },

  async getDeleted(): Promise<MedicalRecord[]> {
    const q = query(
      collection(db, 'medicalRecords'), 
      where('deletedAt', '!=', null),
      orderBy('deletedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
        deletedAt: data.deletedAt?.toDate ? data.deletedAt.toDate() : new Date(data.deletedAt)
      };
    }) as MedicalRecord[];
  },

  async search(filters: SearchFilters): Promise<MedicalRecord[]> {
    let q = query(collection(db, 'medicalRecords'), orderBy('createdAt', 'desc'));

    // Solo incluir registros no eliminados por defecto
    if (!filters.includeDeleted) {
      q = query(q, where('deletedAt', '==', null));
    }

    if (filters.name) {
      q = query(q, where('patientName', '>=', filters.name), where('patientName', '<=', filters.name + '\uf8ff'));
    }

    if (filters.surname) {
      q = query(q, where('patientSurname', '>=', filters.surname), where('patientSurname', '<=', filters.surname + '\uf8ff'));
    }

    if (filters.dni) {
      q = query(q, where('patientDni', '==', filters.dni));
    }

    if (filters.dateFrom) {
      q = query(q, where('createdAt', '>=', filters.dateFrom));
    }

    if (filters.dateTo) {
      q = query(q, where('createdAt', '<=', filters.dateTo));
    }

    const querySnapshot = await getDocs(q);
    let records = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
        deletedAt: data.deletedAt?.toDate ? data.deletedAt.toDate() : data.deletedAt ? new Date(data.deletedAt) : undefined
      };
    }) as MedicalRecord[];

    // Filtro por palabras clave en el reporte
    if (filters.keywords) {
      const keywords = filters.keywords.toLowerCase();
      records = records.filter(record =>
        record.report.toLowerCase().includes(keywords)
      );
    }

    return records;
  },

  async getById(id: string): Promise<MedicalRecord | null> {
    const docRef = doc(db, 'medicalRecords', id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
        deletedAt: data.deletedAt?.toDate ? data.deletedAt.toDate() : data.deletedAt ? new Date(data.deletedAt) : undefined
      } as MedicalRecord;
    }
    return null;
  },

  // Soft delete - mover a papelera
  async softDelete(id: string): Promise<void> {
    const docRef = doc(db, 'medicalRecords', id);
    await updateDoc(docRef, {
      deletedAt: new Date(),
      updatedAt: new Date()
    });
  },

  // Recuperar de la papelera
  async restore(id: string): Promise<void> {
    const docRef = doc(db, 'medicalRecords', id);
    await updateDoc(docRef, {
      deletedAt: null,
      updatedAt: new Date()
    });
  },

  // Eliminación definitiva
  async delete(id: string): Promise<void> {
    const docRef = doc(db, 'medicalRecords', id);
    await deleteDoc(docRef);
  },

  // Limpiar registros eliminados hace más de 30 días
  async cleanupOldDeleted(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const q = query(
      collection(db, 'medicalRecords'),
      where('deletedAt', '!=', null),
      where('deletedAt', '<', thirtyDaysAgo)
    );

    const querySnapshot = await getDocs(q);
    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    return querySnapshot.docs.length;
  },

  // Actualizar registro médico
  async update(id: string, updates: Partial<Omit<MedicalRecord, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>): Promise<void> {
    const docRef = doc(db, 'medicalRecords', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date()
    });
  }
};

export const storageService = {
  async uploadPDF(file: File, patientId: string): Promise<string> {
    const storageRef = ref(storage, `pdfs/${patientId}/${file.name}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  }
}; 