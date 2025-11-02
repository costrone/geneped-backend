export interface Patient {
  id?: string;
  userId?: string;
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

// Interfaces para el sistema de facturación según RD 1007/2023
export interface CompanyInfo {
  id?: string;
  userId: string;
  companyName: string;
  taxId: string; // NIF/CIF
  address: string;
  city: string;
  postalCode: string;
  province: string;
  country: string;
  phone: string;
  email: string;
  website?: string;
  logoUrl?: string;
  bankAccount?: string;
  bankName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate: number; // IVA en porcentaje
  subtotal: number;
  taxAmount: number;
  total: number;
}

export interface Invoice {
  id?: string;
  userId: string;
  medicalRecordId: string;
  invoiceNumber: string; // Número secuencial único
  invoiceDate: Date;
  dueDate: Date;
  patientInfo: {
    name: string;
    surname: string;
    dni: string;
    address?: string;
    city?: string;
    postalCode?: string;
    province?: string;
  };
  companyInfo: CompanyInfo;
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;
  notes?: string;
  terms?: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  paymentMethod?: string;
  paymentDate?: Date;
  xmlContent?: string; // Contenido XML según Facturae
  pdfUrl?: string;
  auditTrail: AuditLog[]; // Trazabilidad según SIF
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  action: 'created' | 'modified' | 'sent' | 'paid' | 'cancelled' | 'viewed' | 'exported';
  userId: string;
  userEmail: string;
  timestamp: Date;
  details: string;
  ipAddress?: string;
  userAgent?: string;
  // Campos criptográficos requeridos por Verifactu
  signature: string; // Firma digital del evento
  hash: string; // Hash del evento actual
  previousHash: string; // Hash del evento anterior (encadenamiento)
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