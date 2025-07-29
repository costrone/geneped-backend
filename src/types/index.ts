export interface Patient {
  id?: string;
  name: string;
  surname: string;
  dni: string;
  birthDate: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MedicalRecord {
  id?: string;
  patientId: string;
  patientName: string;
  patientSurname: string;
  patientDni: string;
  patientBirthDate: string;
  reportType: 'Geneped' | 'Medicaes';
  report: string;
  pdfUrl?: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date; // Campo para la papelera
}

export interface SearchFilters {
  name?: string;
  surname?: string;
  dni?: string;
  dateFrom?: Date;
  dateTo?: Date;
  keywords?: string;
  includeDeleted?: boolean; // Para incluir registros eliminados en búsquedas
} 