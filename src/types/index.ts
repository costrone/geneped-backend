export interface Patient {
  id?: string;
  name: string;
  surname: string;
  dni: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MedicalRecord {
  id?: string;
  patientId: string;
  patientName: string;
  patientSurname: string;
  patientDni: string;
  report: string;
  pdfUrl?: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchFilters {
  name?: string;
  surname?: string;
  dni?: string;
  dateFrom?: Date;
  dateTo?: Date;
  keywords?: string;
} 