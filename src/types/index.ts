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
  userId: string; // ID del usuario que creó el registro
  patientId: string;
  patientName: string;
  patientSurname: string;
  patientDni: string;
  patientBirthDate: string;
  reportType: 'Geneped' | 'Medicaes';
  report: string;
  requestedTests?: string; // Campo para las pruebas solicitadas
  uploadedDocuments?: string[]; // Array de URLs de documentos subidos
  invoiceIssued?: boolean; // Factura emitida (sí/no)
  paid?: boolean; // Pagado (sí/no)
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
  invoiceIssued?: boolean; // Filtro por factura emitida
  paid?: boolean; // Filtro por pagado
  includeDeleted?: boolean; // Para incluir registros eliminados en búsquedas
} 