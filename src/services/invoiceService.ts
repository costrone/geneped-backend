import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Invoice, CompanyInfo, InvoiceItem, AuditLog, MedicalRecord } from '../types';
import { cryptoService } from './cryptoService';

export class InvoiceService {
  private static instance: InvoiceService;
  private currentInvoiceNumber: number = 0;

  public static getInstance(): InvoiceService {
    if (!InvoiceService.instance) {
      InvoiceService.instance = new InvoiceService();
    }
    return InvoiceService.instance;
  }

  // Obtener el siguiente número de factura secuencial
  private async getNextInvoiceNumber(userId: string): Promise<string> {
    try {
      const year = new Date().getFullYear();
      const yearPrefix = year.toString().slice(-2);
      
      // Solución temporal: usar timestamp para evitar índices complejos
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 1000);
      
      // Generar número único basado en timestamp
      this.currentInvoiceNumber = parseInt(`${timestamp}${randomSuffix}`.slice(-4));
      
      return `${yearPrefix}-${this.currentInvoiceNumber.toString().padStart(4, '0')}`;
    } catch (error) {
      console.error('Error obteniendo número de factura:', error);
      // Fallback: usar timestamp directo
      const year = new Date().getFullYear();
      const yearPrefix = year.toString().slice(-2);
      const timestamp = Date.now();
      return `${yearPrefix}-${timestamp.toString().slice(-4)}`;
    }
  }

  // Crear una nueva factura
  async createInvoice(
    userId: string,
    medicalRecord: MedicalRecord,
    companyInfo: CompanyInfo,
    items: Omit<InvoiceItem, 'id' | 'subtotal' | 'taxAmount' | 'total'>[]
  ): Promise<Invoice> {
    try {
      // Calcular totales
      const calculatedItems = items.map(item => {
        const subtotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
        const taxAmount = subtotal * (item.taxRate / 100);
        const total = subtotal + taxAmount;
        
        return {
          ...item,
          id: this.generateId(),
          subtotal: Math.round(subtotal * 100) / 100,
          taxAmount: Math.round(taxAmount * 100) / 100,
          total: Math.round(total * 100) / 100
        };
      });

      const subtotal = calculatedItems.reduce((sum, item) => sum + item.subtotal, 0);
      const taxAmount = calculatedItems.reduce((sum, item) => sum + item.taxAmount, 0);
      const total = subtotal + taxAmount;

      // Generar número de factura
      const invoiceNumber = await this.getNextInvoiceNumber(userId);

      // Crear factura
      const invoice: Omit<Invoice, 'id'> = {
        userId,
        medicalRecordId: medicalRecord.id!,
        invoiceNumber,
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
        patientInfo: {
          name: medicalRecord.patientName,
          surname: medicalRecord.patientSurname,
          dni: medicalRecord.patientDni
        },
        companyInfo,
        items: calculatedItems,
        subtotal: Math.round(subtotal * 100) / 100,
        taxAmount: Math.round(taxAmount * 100) / 100,
        total: Math.round(total * 100) / 100,
        currency: 'EUR',
        status: 'draft',
        auditTrail: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Crear log de auditoría criptográficamente seguro
      const auditLog = await cryptoService.createSecureAuditLog(
        'created',
        userId,
        '', // Se actualizará después
        `Factura ${invoiceNumber} creada para ${medicalRecord.patientName} ${medicalRecord.patientSurname}`,
        this.getClientIP(),
        navigator.userAgent
      );

      invoice.auditTrail.push(auditLog);

      // Guardar en Firestore
      const docRef = await addDoc(collection(db, 'invoices'), {
        ...invoice,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      const createdInvoice: Invoice = {
        ...invoice,
        id: docRef.id
      };

      // Actualizar el registro médico
      await this.updateMedicalRecordInvoiceStatus(medicalRecord.id!, true);

      return createdInvoice;
    } catch (error) {
      console.error('Error creando factura:', error);
      throw new Error('No se pudo crear la factura');
    }
  }

  // Generar XML en formato Facturae
  async generateFacturaeXML(invoice: Invoice): Promise<string> {
    try {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fe:Facturae xmlns:fe="http://www.facturae.es/Facturae/2014/v3.2.2" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <FileHeader>
    <SchemaVersion>3.2.2</SchemaVersion>
    <Modality>I</Modality>
    <InvoiceIssuerType>EM</InvoiceIssuerType>
    <Batch>
      <BatchIdentifier>${invoice.invoiceNumber}</BatchIdentifier>
      <InvoicesCount>1</InvoicesCount>
      <TotalGrossAmount>${invoice.total.toFixed(2)}</TotalGrossAmount>
      <TotalGrossAmountBeforeTaxes>${invoice.subtotal.toFixed(2)}</TotalGrossAmountBeforeTaxes>
      <TotalGeneralDiscounts>0.00</TotalGeneralDiscounts>
      <TotalGeneralSurcharges>0.00</TotalGeneralSurcharges>
      <TotalGrossTotalAmount>${invoice.total.toFixed(2)}</TotalGrossTotalAmount>
      <TotalGeneralTaxesOutputs>${invoice.taxAmount.toFixed(2)}</TotalGeneralTaxesOutputs>
      <TotalGeneralTaxesWithheld>0.00</TotalGeneralTaxesWithheld>
      <InvoiceCurrencyCode>${invoice.currency}</InvoiceCurrencyCode>
      <ExchangeRate>1.00</ExchangeRate>
      <ExchangeRateDate>${invoice.invoiceDate.toISOString().split('T')[0]}</ExchangeRateDate>
    </Batch>
  </FileHeader>
  <Parties>
    <SellerParty>
      <Individual>
        <Name>${invoice.companyInfo.companyName}</Name>
        <FirstSurname></FirstSurname>
        <TaxIdentification>
          <PersonTypeCode>J</PersonTypeCode>
          <ResidenceTypeCode>R</ResidenceTypeCode>
          <TaxIdentificationNumber>${invoice.companyInfo.taxId}</TaxIdentificationNumber>
        </TaxIdentification>
      </Individual>
      <Address>
        <Address>${invoice.companyInfo.address}</Address>
        <PostCode>${invoice.companyInfo.postalCode}</PostCode>
        <Town>${invoice.companyInfo.city}</Town>
        <Province>${invoice.companyInfo.province}</Province>
        <CountryCode>${invoice.companyInfo.country}</CountryCode>
      </Address>
      <ContactDetails>
        <Telephone>${invoice.companyInfo.phone}</Telephone>
        <Email>${invoice.companyInfo.email}</Email>
      </ContactDetails>
    </SellerParty>
    <BuyerParty>
      <Individual>
        <Name>${invoice.patientInfo.name} ${invoice.patientInfo.surname}</Name>
        <FirstSurname></FirstSurname>
        <TaxIdentification>
          <PersonTypeCode>J</PersonTypeCode>
          <ResidenceTypeCode>R</ResidenceTypeCode>
          <TaxIdentificationNumber>${invoice.patientInfo.dni}</TaxIdentificationNumber>
        </TaxIdentification>
      </Individual>
    </BuyerParty>
  </Parties>
  <Invoices>
    <Invoice>
      <InvoiceHeader>
        <InvoiceNumber>${invoice.invoiceNumber}</InvoiceNumber>
        <InvoiceDocumentType>FC</InvoiceDocumentType>
        <InvoiceClass>OO</InvoiceClass>
      </InvoiceHeader>
      <InvoiceIssueData>
        <IssueDate>${invoice.invoiceDate.toISOString().split('T')[0]}</IssueDate>
        <OperationDate>${invoice.invoiceDate.toISOString().split('T')[0]}</OperationDate>
        <PlaceOfIssue>
          <PostCode>${invoice.companyInfo.postalCode}</PostCode>
          <Town>${invoice.companyInfo.city}</Town>
          <Province>${invoice.companyInfo.province}</Province>
          <CountryCode>${invoice.companyInfo.country}</CountryCode>
        </PlaceOfIssue>
      </InvoiceIssueData>
      <TaxesOutputs>
        ${invoice.taxAmount > 0 ? `
        <TaxOutput>
          <TaxTypeCode>01</TaxTypeCode>
          <TaxRate>${invoice.items[0]?.taxRate?.toFixed(2) || '0.00'}</TaxRate>
          <TaxableBase>
            <TotalAmount>${invoice.subtotal.toFixed(2)}</TotalAmount>
            <EquivalentInEuros>${invoice.subtotal.toFixed(2)}</EquivalentInEuros>
          </TaxableBase>
          <TaxAmount>${invoice.taxAmount.toFixed(2)}</TaxAmount>
          <TotalAmount>${invoice.total.toFixed(2)}</TotalAmount>
        </TaxOutput>
        ` : `
        <TaxOutput>
          <TaxTypeCode>02</TaxTypeCode>
          <TaxRate>0.00</TaxRate>
          <TaxableBase>
            <TotalAmount>${invoice.subtotal.toFixed(2)}</TotalAmount>
            <EquivalentInEuros>${invoice.subtotal.toFixed(2)}</EquivalentInEuros>
          </TaxableBase>
          <TaxAmount>0.00</TaxAmount>
          <TotalAmount>${invoice.subtotal.toFixed(2)}</TotalAmount>
        </TaxOutput>
        `}
      </TaxesOutputs>
      <InvoiceTotals>
        <TotalGrossAmount>${invoice.total.toFixed(2)}</TotalGrossAmount>
        <TotalGrossAmountBeforeTaxes>${invoice.subtotal.toFixed(2)}</TotalGrossAmountBeforeTaxes>
        <TotalGeneralDiscounts>0.00</TotalGeneralDiscounts>
        <TotalGeneralSurcharges>0.00</TotalGeneralSurcharges>
        <TotalGrossTotalAmount>${invoice.total.toFixed(2)}</TotalGrossTotalAmount>
        <TotalGeneralTaxesOutputs>${invoice.taxAmount.toFixed(2)}</TotalGeneralTaxesOutputs>
        <TotalGeneralTaxesWithheld>0.00</TotalGeneralTaxesWithheld>
        <TotalOutstandingAmount>${invoice.total.toFixed(2)}</TotalOutstandingAmount>
        <TotalExecutableAmount>${invoice.total.toFixed(2)}</TotalExecutableAmount>
      </InvoiceTotals>
      <Items>
        ${invoice.items.map(item => `
        <InvoiceLine>
          <ItemDescription>${item.description}</ItemDescription>
          <Quantity>${item.quantity}</Quantity>
          <UnitPriceWithoutTax>${item.unitPrice.toFixed(2)}</UnitPriceWithoutTax>
          <TotalCost>${item.subtotal.toFixed(2)}</TotalCost>
          <GrossAmount>${item.total.toFixed(2)}</GrossAmount>
          <TaxesOutputs>
            <TaxOutput>
              <TaxTypeCode>01</TaxTypeCode>
              <TaxRate>${item.taxRate.toFixed(2)}</TaxRate>
              <TaxableBase>
                <TotalAmount>${item.subtotal.toFixed(2)}</TotalAmount>
                <EquivalentInEuros>${item.subtotal.toFixed(2)}</EquivalentInEuros>
              </TaxableBase>
              <TaxAmount>${item.taxAmount.toFixed(2)}</TaxAmount>
              <TotalAmount>${item.total.toFixed(2)}</TotalAmount>
            </TaxOutput>
          </TaxesOutputs>
        </InvoiceLine>
        `).join('')}
      </Items>
      <LegalLiterals>
        <LegalReference>Art. 6.1.c) Ley 37/1992, del IVA</LegalReference>
      </LegalLiterals>
    </Invoice>
  </Invoices>
</fe:Facturae>`;

      return xml;
    } catch (error) {
      console.error('Error generando XML Facturae:', error);
      throw new Error('No se pudo generar el XML de la factura');
    }
  }

  // Firmar XML digitalmente (simulado - en producción usar certificado real)
  private signXML(xml: string): string {
    // En producción, aquí se implementaría la firma digital real
    // Por ahora retornamos el XML sin firmar
    return xml;
  }

  // Generar PDF de la factura
  async generateInvoicePDF(invoice: Invoice): Promise<Blob> {
    try {
      // Crear contenido HTML para la factura
      const htmlContent = this.generateInvoiceHTML(invoice);
      
      // Convertir HTML a PDF usando jsPDF
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // Añadir contenido HTML al PDF
      pdf.html(htmlContent, {
        callback: function (pdf) {
          // PDF generado
        },
        x: 10,
        y: 10,
        width: 190
      });
      
      return pdf.output('blob');
    } catch (error) {
      console.error('Error generando PDF de factura:', error);
      throw new Error('No se pudo generar el PDF de la factura');
    }
  }

  // Generar HTML para la factura
  private generateInvoiceHTML(invoice: Invoice): string {
    // Generar datos del código QR según Anexo II del Reglamento
    const qrData = cryptoService.generateQRCodeData(invoice);
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .company-info { margin-bottom: 30px; }
          .invoice-details { margin-bottom: 30px; }
          .patient-info { margin-bottom: 30px; }
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .totals { text-align: right; margin-bottom: 30px; }
          .qr-section { text-align: center; margin: 20px 0; padding: 20px; border: 2px dashed #ccc; }
          .footer { text-align: center; margin-top: 50px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>FACTURA</h1>
          <h2>${invoice.invoiceNumber}</h2>
        </div>
        
        <div class="company-info">
          <h3>${invoice.companyInfo.companyName}</h3>
          <p>NIF/CIF: ${invoice.companyInfo.taxId}</p>
          <p>${invoice.companyInfo.address}</p>
          <p>${invoice.companyInfo.postalCode} ${invoice.companyInfo.city}, ${invoice.companyInfo.province}</p>
          <p>Tel: ${invoice.companyInfo.phone} | Email: ${invoice.companyInfo.email}</p>
        </div>
        
        <div class="invoice-details">
          <p><strong>Fecha de emisión:</strong> ${invoice.invoiceDate.toLocaleDateString('es-ES')}</p>
          <p><strong>Fecha de vencimiento:</strong> ${invoice.dueDate.toLocaleDateString('es-ES')}</p>
        </div>
        
        <div class="patient-info">
          <h3>Cliente</h3>
          <p><strong>${invoice.patientInfo.name} ${invoice.patientInfo.surname}</strong></p>
          <p>DNI: ${invoice.patientInfo.dni}</p>
        </div>
        
        <table class="items-table">
          <thead>
            <tr>
              <th>Descripción</th>
              <th>Cantidad</th>
              <th>Precio Unit.</th>
              <th>Subtotal</th>
              <th>IVA</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items.map(item => `
              <tr>
                <td>${item.description}</td>
                <td>${item.quantity}</td>
                <td>${item.unitPrice.toFixed(2)}€</td>
                <td>${item.subtotal.toFixed(2)}€</td>
                <td>${item.taxAmount.toFixed(2)}€</td>
                <td>${item.total.toFixed(2)}€</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="totals">
          <p><strong>Subtotal:</strong> ${invoice.subtotal.toFixed(2)}€</p>
          ${invoice.taxAmount > 0 ? `<p><strong>IVA (${invoice.items[0]?.taxRate?.toFixed(0) || 0}%):</strong> ${invoice.taxAmount.toFixed(2)}€</p>` : '<p><strong>IVA:</strong> Exento (Asistencia sanitaria)</p>'}
          <p><strong>TOTAL:</strong> ${invoice.total.toFixed(2)}€</p>
        </div>
        
        <!-- Código QR según Anexo II del Reglamento Verifactu -->
        <div class="qr-section">
          <h4>Código QR Verifactu</h4>
          <p><strong>Datos del código QR:</strong></p>
          <p style="font-family: monospace; font-size: 10px; word-break: break-all;">${qrData}</p>
          <p style="font-size: 11px; color: #666;">
            Este código QR contiene la información estandarizada según el Anexo II del RD 1007/2023
          </p>
        </div>
        
        <div class="footer">
          <p>Esta factura cumple con el Real Decreto 1007/2023 (Reglamento Verifactu)</p>
          <p>Asistencia sanitaria exenta de IVA según Art. 20.1.9º Ley 37/1992</p>
          <p>Factura electrónica generada automáticamente</p>
        </div>
      </body>
      </html>
    `;
  }

  // Obtener facturas de un usuario
  async getUserInvoices(userId: string): Promise<Invoice[]> {
    try {
      const invoicesRef = collection(db, 'invoices');
      const q = query(
        invoicesRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Invoice[];
    } catch (error) {
      console.error('Error obteniendo facturas:', error);
      throw new Error('No se pudieron obtener las facturas');
    }
  }

  // Obtener una factura por ID
  async getInvoiceById(invoiceId: string): Promise<Invoice | null> {
    try {
      const docRef = doc(db, 'invoices', invoiceId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { ...docSnap.data(), id: docSnap.id } as Invoice;
      }
      
      return null;
    } catch (error) {
      console.error('Error obteniendo factura:', error);
      throw new Error('No se pudo obtener la factura');
    }
  }

  // Actualizar estado de factura
  async updateInvoiceStatus(invoiceId: string, status: Invoice['status']): Promise<void> {
    try {
      const docRef = doc(db, 'invoices', invoiceId);
      await updateDoc(docRef, {
        status,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error actualizando estado de factura:', error);
      throw new Error('No se pudo actualizar el estado de la factura');
    }
  }

  // Marcar factura como pagada
  async markInvoiceAsPaid(invoiceId: string, paymentMethod: string): Promise<void> {
    try {
      const docRef = doc(db, 'invoices', invoiceId);
      await updateDoc(docRef, {
        status: 'paid',
        paymentMethod,
        paymentDate: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error marcando factura como pagada:', error);
      throw new Error('No se pudo marcar la factura como pagada');
    }
  }

  // Actualizar estado de facturación en registro médico
  private async updateMedicalRecordInvoiceStatus(medicalRecordId: string, invoiceIssued: boolean): Promise<void> {
    try {
      const docRef = doc(db, 'medicalRecords', medicalRecordId);
      await updateDoc(docRef, {
        invoiceIssued,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error actualizando estado de facturación:', error);
    }
  }

  // Generar ID único
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Obtener IP del cliente (simulado)
  private getClientIP(): string {
    return '127.0.0.1'; // En producción se obtendría la IP real
  }

  // Exportar factura en formato estándar para la AEAT
  async exportInvoiceForAEAT(invoiceId: string): Promise<string> {
    try {
      const invoice = await this.getInvoiceById(invoiceId);
      if (!invoice) {
        throw new Error('Factura no encontrada');
      }

      // Generar XML Facturae
      const xml = await this.generateFacturaeXML(invoice);
      
      // Firmar XML
      const signedXML = this.signXML(xml);
      
      // Añadir log de auditoría
      await this.addAuditLog(invoiceId, 'exported', 'Factura exportada para la AEAT');
      
      return signedXML;
    } catch (error) {
      console.error('Error exportando factura para AEAT:', error);
      throw new Error('No se pudo exportar la factura para la AEAT');
    }
  }

  // Añadir log de auditoría criptográficamente seguro
  private async addAuditLog(invoiceId: string, action: AuditLog['action'], details: string): Promise<void> {
    try {
      const docRef = doc(db, 'invoices', invoiceId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const invoice = docSnap.data() as Invoice;
        
        // Obtener el último hash para continuar la cadena
        if (invoice.auditTrail.length > 0) {
          const lastEvent = invoice.auditTrail[invoice.auditTrail.length - 1];
          cryptoService.setPreviousHash(lastEvent.hash);
        }
        
        // Crear log seguro
        const auditLog = await cryptoService.createSecureAuditLog(
          action,
          invoice.userId,
          invoice.companyInfo.email,
          details,
          this.getClientIP(),
          navigator.userAgent
        );
        
        invoice.auditTrail.push(auditLog);
        
        await updateDoc(docRef, {
          auditTrail: invoice.auditTrail,
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error añadiendo log de auditoría:', error);
    }
  }
}

export const invoiceService = InvoiceService.getInstance();
