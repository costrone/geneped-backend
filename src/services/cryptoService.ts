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
  async generateChainedHash(eventData: string): Promise<string> {
    const combinedData = `${this.previousHash}:${eventData}:${Date.now()}`;
    const newHash = await this.generateHash(combinedData);
    this.previousHash = newHash;
    return newHash;
  }

  // Firmar digitalmente un registro de evento
  async signEvent(event: Omit<AuditLog, 'id' | 'signature' | 'hash' | 'previousHash'>): Promise<{
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
      userAgent: event.userAgent
    });

    // Generar hash encadenado
    const hash = await this.generateChainedHash(eventData);
    
    // Simular firma digital (en producción usar certificado real)
    const signature = await this.generateHash(`${hash}:${eventData}`);
    
    return {
      signature,
      hash,
      previousHash: this.previousHash,
      timestamp: Date.now()
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
        userAgent: event.userAgent
      });

      const expectedHash = await this.generateHash(`${event.previousHash}:${eventData}:${event.timestamp}`);
      return expectedHash === event.hash;
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
      r: invoice.taxAmount > 0 ? invoice.items[0]?.taxRate?.toFixed(0) || '21' : '0' // Tipo de IVA
    };

    return JSON.stringify(qrData);
  }

  // Generar hash de la factura completa para integridad
  async generateInvoiceHash(invoice: Invoice): Promise<string> {
    const invoiceData = JSON.stringify({
      number: invoice.invoiceNumber,
      date: invoice.invoiceDate,
      total: invoice.total,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      items: invoice.items,
      company: invoice.companyInfo.taxId,
      patient: invoice.patientInfo.dni
    });

    return await this.generateHash(invoiceData);
  }

  // Crear registro de evento criptográficamente seguro
  async createSecureAuditLog(
    action: AuditLog['action'],
    userId: string,
    userEmail: string,
    details: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuditLog> {
    const baseEvent = {
      action,
      userId,
      userEmail,
      timestamp: new Date(),
      details,
      ipAddress: ipAddress || '127.0.0.1',
      userAgent: userAgent || navigator.userAgent
    };

    const cryptoData = await this.signEvent(baseEvent);

    return {
      id: this.generateId(),
      ...baseEvent,
      signature: cryptoData.signature,
      hash: cryptoData.hash,
      previousHash: cryptoData.previousHash,
      timestamp: new Date(cryptoData.timestamp)
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
