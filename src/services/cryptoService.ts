import { Invoice, AuditLog } from '../types';

export class CryptoService {
  private static instance: CryptoService;
  private previousHash: string = '';

  public static getInstance(): CryptoService {
    if (!CryptoService.instance) {
      CryptoService.instance = new CryptoService();
    }
    return CryptoService.instance;
  }

  // Generar hash SHA-256 de una cadena
  async generateHash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Generar hash encadenado para el registro de eventos
  async generateChainedHash(
    eventData: string,
    previousHash: string = '',
    timestamp?: number
  ): Promise<string> {
    // Si es el primer evento, no usar previousHash
    const timestampValue = timestamp || Date.now();
    const combinedData = previousHash
      ? `${previousHash}:${eventData}:${timestampValue}`
      : `${eventData}:${timestampValue}`;
    const newHash = await this.generateHash(combinedData);
    return newHash;
  }

  // Firmar digitalmente un registro de evento
  async signEvent(
    event: Omit<AuditLog, 'id' | 'signature' | 'hash' | 'previousHash'>,
    previousHash: string = ''
  ): Promise<{
    signature: string;
    hash: string;
    previousHash: string;
    timestamp: number;
  }> {
    // Crear datos del evento para firma
    const eventData = JSON.stringify({
      action: event.action,
      userId: event.userId,
      timestamp: event.timestamp,
      details: event.details,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
    });

    // Obtener timestamp del evento
    const timestampValue =
      event.timestamp instanceof Date
        ? event.timestamp.getTime()
        : typeof event.timestamp === 'number'
        ? event.timestamp
        : Date.now();

    // Generar hash encadenado (sin usar this.previousHash para evitar estado compartido)
    const hash = await this.generateChainedHash(
      eventData,
      previousHash,
      timestampValue
    );

    // Simular firma digital (en producción usar certificado real)
    // La firma debe incluir el hash y los datos del evento
    const signatureData = previousHash
      ? `${previousHash}:${hash}:${eventData}`
      : `${hash}:${eventData}`;
    const signature = await this.generateHash(signatureData);

    return {
      signature,
      hash,
      previousHash: previousHash, // Para el primer evento será ''
      timestamp: timestampValue,
    };
  }

  // Verificar integridad de un registro
  async verifyEventIntegrity(event: AuditLog): Promise<boolean> {
    try {
      const eventData = JSON.stringify({
        action: event.action,
        userId: event.userId,
        timestamp: event.timestamp,
        details: event.details,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
      });

      // Convertir timestamp a número si es Date
      const timestampValue =
        event.timestamp instanceof Date
          ? event.timestamp.getTime()
          : typeof event.timestamp === 'number'
          ? event.timestamp
          : new Date(event.timestamp).getTime();

      // Para el evento 'created', el hash es el hash de la factura completa, no un hash encadenado
      // Por lo tanto, solo verificamos la firma y que previousHash esté vacío
      if (event.action === 'created') {
        // Verificar que previousHash esté vacío
        if (event.previousHash !== '') {
          return false;
        }
        // Verificar la firma (el hash es el hash de la factura completa)
        const signatureData = `${event.hash}:${eventData}`;
        const expectedSignature = await this.generateHash(signatureData);
        return expectedSignature === event.signature;
      } else {
        // Para otros eventos, verificamos el hash encadenado
        const combinedData = event.previousHash
          ? `${event.previousHash}:${eventData}:${timestampValue}`
          : `${eventData}:${timestampValue}`;
        const expectedHash = await this.generateHash(combinedData);

        // Verificar que el hash coincide
        if (expectedHash !== event.hash) {
          return false;
        }

        // Verificar la firma
        const signatureData = event.previousHash
          ? `${event.previousHash}:${event.hash}:${eventData}`
          : `${event.hash}:${eventData}`;
        const expectedSignature = await this.generateHash(signatureData);

        return expectedSignature === event.signature;
      }
    } catch (error) {
      console.error('Error verificando integridad del evento:', error);
      return false;
    }
  }

  // Generar código QR para factura según Anexo II del Reglamento
  generateQRCodeData(invoice: Invoice): string {
    const qrData = {
      // Datos obligatorios según Anexo II
      n: invoice.invoiceNumber, // Número de factura
      d: invoice.invoiceDate.toISOString().split('T')[0], // Fecha
      t: invoice.total.toFixed(2), // Total
      b: invoice.subtotal.toFixed(2), // Base imponible
      i: invoice.companyInfo.taxId, // NIF emisor
      c: invoice.patientInfo.dni, // NIF receptor
      s: 'ES', // País
      v: invoice.taxAmount > 0 ? '01' : '02', // Tipo de IVA (01=general, 02=exento)
      r:
        invoice.taxAmount > 0
          ? invoice.items[0]?.taxRate?.toFixed(0) || '21'
          : '0', // Tipo de IVA
    };

    return JSON.stringify(qrData);
  }

  // Generar hash de la factura completa para integridad
  async generateInvoiceHash(invoice: Invoice): Promise<string> {
    // Normalizar fechas a ISO string para consistencia
    const normalizeDate = (date: Date | any): string => {
      if (!date) return '';
      if (date instanceof Date) {
        return date.toISOString().split('T')[0]; // Solo fecha, sin hora
      }
      if (date.toDate && typeof date.toDate === 'function') {
        return date.toDate().toISOString().split('T')[0];
      }
      if (typeof date === 'string') {
        return new Date(date).toISOString().split('T')[0];
      }
      return '';
    };

    // Normalizar items para consistencia (ordenar por descripción)
    const normalizedItems = [...invoice.items]
      .sort((a, b) => a.description.localeCompare(b.description))
      .map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        subtotal: item.subtotal,
        taxAmount: item.taxAmount,
        total: item.total,
      }));

    // Crear objeto de datos normalizado con todos los campos relevantes
    const invoiceData = {
      userId: invoice.userId,
      medicalRecordId: invoice.medicalRecordId,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: normalizeDate(invoice.invoiceDate),
      dueDate: normalizeDate(invoice.dueDate),
      patientInfo: {
        name: invoice.patientInfo.name,
        surname: invoice.patientInfo.surname,
        dni: invoice.patientInfo.dni,
        address: invoice.patientInfo.address || '',
        city: invoice.patientInfo.city || '',
        postalCode: invoice.patientInfo.postalCode || '',
        province: invoice.patientInfo.province || '',
      },
      companyInfo: {
        companyName: invoice.companyInfo.companyName,
        taxId: invoice.companyInfo.taxId,
        address: invoice.companyInfo.address,
        city: invoice.companyInfo.city,
        postalCode: invoice.companyInfo.postalCode,
        province: invoice.companyInfo.province,
        phone: invoice.companyInfo.phone,
        email: invoice.companyInfo.email,
      },
      items: normalizedItems,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      currency: invoice.currency,
      status: invoice.status,
      // Campos opcionales solo si tienen valor
      ...(invoice.paymentMethod && { paymentMethod: invoice.paymentMethod }),
      ...(invoice.paymentDate && {
        paymentDate: normalizeDate(invoice.paymentDate),
      }),
      ...(invoice.notes && { notes: invoice.notes }),
      ...(invoice.terms && { terms: invoice.terms }),
    };

    // Serializar de forma determinística
    const invoiceDataString = JSON.stringify(
      invoiceData,
      Object.keys(invoiceData).sort()
    );

    return await this.generateHash(invoiceDataString);
  }

  // Crear registro de evento criptográficamente seguro
  async createSecureAuditLog(
    action: AuditLog['action'],
    userId: string,
    userEmail: string,
    details: string,
    ipAddress?: string,
    userAgent?: string,
    previousHash: string = '' // Hash del evento anterior (vacío para el primer evento)
  ): Promise<AuditLog> {
    const baseEvent = {
      action,
      userId,
      userEmail,
      timestamp: new Date(),
      details,
      ipAddress: ipAddress || '127.0.0.1',
      userAgent: userAgent || navigator.userAgent,
    };

    const cryptoData = await this.signEvent(baseEvent, previousHash);

    return {
      id: this.generateId(),
      ...baseEvent,
      signature: cryptoData.signature,
      hash: cryptoData.hash,
      previousHash: cryptoData.previousHash, // Será '' para el primer evento
      timestamp: new Date(cryptoData.timestamp),
    };
  }

  // Generar ID único
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Obtener el hash anterior para continuar la cadena
  getPreviousHash(): string {
    return this.previousHash;
  }

  // Establecer hash anterior (para continuar cadena desde base de datos)
  setPreviousHash(hash: string): void {
    this.previousHash = hash;
  }
}

export const cryptoService = CryptoService.getInstance();
