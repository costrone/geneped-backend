import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  doc, 
  getDoc 
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
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt),
      updatedAt: doc.data().updatedAt?.toDate ? doc.data().updatedAt.toDate() : new Date(doc.data().updatedAt)
    })) as Patient[];
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

  async getAll(): Promise<MedicalRecord[]> {
    const querySnapshot = await getDocs(collection(db, 'medicalRecords'));
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)
      };
    }) as MedicalRecord[];
  },

  async search(filters: SearchFilters): Promise<MedicalRecord[]> {
    let q = query(collection(db, 'medicalRecords'), orderBy('createdAt', 'desc'));

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
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)
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
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)
      } as MedicalRecord;
    }
    return null;
  }
};

export const storageService = {
  async uploadPDF(file: File, filename: string): Promise<string> {
    const storageRef = ref(storage, `pdfs/${filename}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  }
}; 