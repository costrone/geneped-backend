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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  Invoice,
  CompanyInfo,
  InvoiceItem,
  AuditLog,
  MedicalRecord,
  InvoiceDraft,
} from '../types';
import { cryptoService } from './cryptoService';

export class InvoiceService {
  private static instance: InvoiceService;
  private currentInvoiceNumber: number = 0;
  private lastQRImageDataUrl: string | null = null;

  public static getInstance(): InvoiceService {
    if (!InvoiceService.instance) {
      InvoiceService.instance = new InvoiceService();
    }
    return InvoiceService.instance;
  }

  // Obtener el siguiente número de factura secuencial (global para todo el servicio)
  private async getNextInvoiceNumber(userId: string): Promise<string> {
    try {
      const year = new Date().getFullYear();
      const yearPrefix = year.toString().slice(-2);

      // Buscar todas las facturas del año actual (sin filtrar por usuario)
      // La numeración es global para todo el servicio
      const invoicesRef = collection(db, 'invoices');
      const q = query(invoicesRef, orderBy('createdAt', 'desc'));

      const querySnapshot = await getDocs(q);

      // Filtrar facturas del año actual y encontrar el número más alto
      let maxSequence = 0;
      const yearPattern = new RegExp(`^${yearPrefix}-(\\d+)$`);

      querySnapshot.docs.forEach(doc => {
        const invoice = doc.data() as Invoice;
        const invoiceNumber = invoice.invoiceNumber;
        const match = invoiceNumber.match(yearPattern);

        if (match) {
          const sequence = parseInt(match[1]);
          if (sequence > maxSequence) {
            maxSequence = sequence;
          }
        }
      });

      // Generar el siguiente número secuencial
      const nextSequence = maxSequence + 1;
      return `${yearPrefix}-${nextSequence.toString().padStart(4, '0')}`;
    } catch (error) {
      console.error('Error obteniendo número de factura:', error);
      // Fallback mejorado: buscar todas las facturas sin filtro de fecha ni usuario
      try {
        const invoicesRef = collection(db, 'invoices');
        const q = query(invoicesRef);

        const querySnapshot = await getDocs(q);
        const year = new Date().getFullYear();
        const yearPrefix = year.toString().slice(-2);
        let maxSequence = 0;
        const yearPattern = new RegExp(`^${yearPrefix}-(\\d+)$`);

        querySnapshot.docs.forEach(doc => {
          const invoice = doc.data() as Invoice;
          const invoiceNumber = invoice.invoiceNumber || '';
          const match = invoiceNumber.match(yearPattern);

          if (match) {
            const sequence = parseInt(match[1]);
            if (sequence > maxSequence) {
              maxSequence = sequence;
            }
          }
        });

        const nextSequence = maxSequence + 1;
        return `${yearPrefix}-${nextSequence.toString().padStart(4, '0')}`;
      } catch (fallbackError) {
        console.error('Error en fallback de numeración:', fallbackError);
        // Último recurso: usar timestamp pero con formato correcto
        const year = new Date().getFullYear();
        const yearPrefix = year.toString().slice(-2);
        // Usar solo los últimos 4 dígitos del timestamp para mantener formato
        const timestamp = Date.now().toString().slice(-6);
        const sequence = parseInt(timestamp) % 10000; // Asegurar que sea máximo 4 dígitos
        return `${yearPrefix}-${sequence.toString().padStart(4, '0')}`;
      }
    }
  }

  // Crear una nueva factura
  async createInvoice(
    userId: string,
    medicalRecord: MedicalRecord,
    companyInfo: CompanyInfo,
    items: Omit<InvoiceItem, 'id' | 'subtotal' | 'taxAmount' | 'total'>[],
    options?: {
      isPaid?: boolean;
      paymentMethod?: string;
    }
  ): Promise<Invoice> {
    try {
      // Calcular totales
      const calculatedItems = items.map(item => {
        const subtotal =
          item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
        const taxAmount = subtotal * (item.taxRate / 100);
        const total = subtotal + taxAmount;

        return {
          ...item,
          id: this.generateId(),
          subtotal: Math.round(subtotal * 100) / 100,
          taxAmount: Math.round(taxAmount * 100) / 100,
          total: Math.round(total * 100) / 100,
        };
      });

      const subtotal = calculatedItems.reduce(
        (sum, item) => sum + item.subtotal,
        0
      );
      const taxAmount = calculatedItems.reduce(
        (sum, item) => sum + item.taxAmount,
        0
      );
      const total = subtotal + taxAmount;

      // Generar número de factura
      const invoiceNumber = await this.getNextInvoiceNumber(userId);

      // Crear factura
      const invoiceDate = new Date();
      const invoice: Omit<Invoice, 'id'> = {
        userId,
        medicalRecordId: medicalRecord.id!,
        invoiceNumber,
        invoiceDate,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
        patientInfo: {
          name: medicalRecord.patientName,
          surname: medicalRecord.patientSurname,
          dni: medicalRecord.patientDni,
        },
        companyInfo,
        items: calculatedItems,
        subtotal: Math.round(subtotal * 100) / 100,
        taxAmount: Math.round(taxAmount * 100) / 100,
        total: Math.round(total * 100) / 100,
        currency: 'EUR',
        status: options?.isPaid ? 'paid' : 'sent', // 'paid' si está pagada, 'sent' si no
        paymentMethod: options?.paymentMethod,
        paymentDate: options?.isPaid ? invoiceDate : undefined,
        auditTrail: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Generar hash de la factura completa primero (sin auditTrail para evitar referencia circular)
      const invoiceForHash: Omit<
        Invoice,
        'id' | 'auditTrail' | 'createdAt' | 'updatedAt'
      > = {
        userId: invoice.userId,
        medicalRecordId: invoice.medicalRecordId,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        patientInfo: invoice.patientInfo,
        companyInfo: invoice.companyInfo,
        items: invoice.items,
        subtotal: invoice.subtotal,
        taxAmount: invoice.taxAmount,
        total: invoice.total,
        currency: invoice.currency,
        status: invoice.status,
        paymentMethod: invoice.paymentMethod,
        paymentDate: invoice.paymentDate,
        xmlContent: invoice.xmlContent,
        pdfUrl: invoice.pdfUrl,
        notes: invoice.notes,
        terms: invoice.terms,
      };
      const invoiceHash = await cryptoService.generateInvoiceHash({
        ...invoiceForHash,
        id: '',
        auditTrail: [],
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
      } as Invoice);

      // Crear log de auditoría criptográficamente seguro (primer evento, sin previousHash)
      const auditLog = await cryptoService.createSecureAuditLog(
        'created',
        userId,
        '', // Se actualizará después
        `Factura ${invoiceNumber} creada para ${medicalRecord.patientName} ${medicalRecord.patientSurname}`,
        this.getClientIP(),
        navigator.userAgent,
        '' // Primer evento, no tiene hash anterior
      );

      // Reemplazar el hash del evento con el hash de la factura completa
      auditLog.hash = invoiceHash;
      // Recalcular la firma con el nuevo hash
      const eventData = JSON.stringify({
        action: auditLog.action,
        userId: auditLog.userId,
        timestamp: auditLog.timestamp,
        details: auditLog.details,
        ipAddress: auditLog.ipAddress,
        userAgent: auditLog.userAgent,
      });
      const signatureData = `${auditLog.hash}:${eventData}`;
      auditLog.signature = await cryptoService.generateHash(signatureData);

      invoice.auditTrail.push(auditLog);

      // Preparar datos para Firestore (eliminar campos undefined)
      const firestoreData: any = {
        userId: invoice.userId,
        medicalRecordId: invoice.medicalRecordId,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        patientInfo: invoice.patientInfo,
        companyInfo: invoice.companyInfo,
        items: invoice.items,
        subtotal: invoice.subtotal,
        taxAmount: invoice.taxAmount,
        total: invoice.total,
        currency: invoice.currency,
        status: invoice.status,
        auditTrail: invoice.auditTrail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Solo añadir campos opcionales si tienen valor
      if (invoice.paymentMethod) {
        firestoreData.paymentMethod = invoice.paymentMethod;
      }
      if (invoice.paymentDate) {
        firestoreData.paymentDate = invoice.paymentDate;
      }
      if (invoice.xmlContent) {
        firestoreData.xmlContent = invoice.xmlContent;
      }
      if (invoice.pdfUrl) {
        firestoreData.pdfUrl = invoice.pdfUrl;
      }
      if (invoice.notes) {
        firestoreData.notes = invoice.notes;
      }
      if (invoice.terms) {
        firestoreData.terms = invoice.terms;
      }

      // Guardar en Firestore
      const docRef = await addDoc(collection(db, 'invoices'), firestoreData);

      const createdInvoice: Invoice = {
        ...invoice,
        id: docRef.id,
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
      <TotalGrossAmountBeforeTaxes>${invoice.subtotal.toFixed(
        2
      )}</TotalGrossAmountBeforeTaxes>
      <TotalGeneralDiscounts>0.00</TotalGeneralDiscounts>
      <TotalGeneralSurcharges>0.00</TotalGeneralSurcharges>
      <TotalGrossTotalAmount>${invoice.total.toFixed(2)}</TotalGrossTotalAmount>
      <TotalGeneralTaxesOutputs>${invoice.taxAmount.toFixed(
        2
      )}</TotalGeneralTaxesOutputs>
      <TotalGeneralTaxesWithheld>0.00</TotalGeneralTaxesWithheld>
      <InvoiceCurrencyCode>${invoice.currency}</InvoiceCurrencyCode>
      <ExchangeRate>1.00</ExchangeRate>
      <ExchangeRateDate>${
        invoice.invoiceDate.toISOString().split('T')[0]
      }</ExchangeRateDate>
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
          <TaxIdentificationNumber>${
            invoice.companyInfo.taxId
          }</TaxIdentificationNumber>
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
          <TaxIdentificationNumber>${
            invoice.patientInfo.dni
          }</TaxIdentificationNumber>
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
        <IssueDate>${
          invoice.invoiceDate.toISOString().split('T')[0]
        }</IssueDate>
        <OperationDate>${
          invoice.invoiceDate.toISOString().split('T')[0]
        }</OperationDate>
        <PlaceOfIssue>
          <PostCode>${invoice.companyInfo.postalCode}</PostCode>
          <Town>${invoice.companyInfo.city}</Town>
          <Province>${invoice.companyInfo.province}</Province>
          <CountryCode>${invoice.companyInfo.country}</CountryCode>
        </PlaceOfIssue>
      </InvoiceIssueData>
      <TaxesOutputs>
        ${
          invoice.taxAmount > 0
            ? `
        <TaxOutput>
          <TaxTypeCode>01</TaxTypeCode>
          <TaxRate>${invoice.items[0]?.taxRate?.toFixed(2) || '0.00'}</TaxRate>
          <TaxableBase>
            <TotalAmount>${invoice.subtotal.toFixed(2)}</TotalAmount>
            <EquivalentInEuros>${invoice.subtotal.toFixed(
              2
            )}</EquivalentInEuros>
          </TaxableBase>
          <TaxAmount>${invoice.taxAmount.toFixed(2)}</TaxAmount>
          <TotalAmount>${invoice.total.toFixed(2)}</TotalAmount>
        </TaxOutput>
        `
            : `
        <TaxOutput>
          <TaxTypeCode>02</TaxTypeCode>
          <TaxRate>0.00</TaxRate>
          <TaxableBase>
            <TotalAmount>${invoice.subtotal.toFixed(2)}</TotalAmount>
            <EquivalentInEuros>${invoice.subtotal.toFixed(
              2
            )}</EquivalentInEuros>
          </TaxableBase>
          <TaxAmount>0.00</TaxAmount>
          <TotalAmount>${invoice.subtotal.toFixed(2)}</TotalAmount>
        </TaxOutput>
        `
        }
      </TaxesOutputs>
      <InvoiceTotals>
        <TotalGrossAmount>${invoice.total.toFixed(2)}</TotalGrossAmount>
        <TotalGrossAmountBeforeTaxes>${invoice.subtotal.toFixed(
          2
        )}</TotalGrossAmountBeforeTaxes>
        <TotalGeneralDiscounts>0.00</TotalGeneralDiscounts>
        <TotalGeneralSurcharges>0.00</TotalGeneralSurcharges>
        <TotalGrossTotalAmount>${invoice.total.toFixed(
          2
        )}</TotalGrossTotalAmount>
        <TotalGeneralTaxesOutputs>${invoice.taxAmount.toFixed(
          2
        )}</TotalGeneralTaxesOutputs>
        <TotalGeneralTaxesWithheld>0.00</TotalGeneralTaxesWithheld>
        <TotalOutstandingAmount>${invoice.total.toFixed(
          2
        )}</TotalOutstandingAmount>
        <TotalExecutableAmount>${invoice.total.toFixed(
          2
        )}</TotalExecutableAmount>
      </InvoiceTotals>
      <Items>
        ${invoice.items
          .map(
            item => `
        <InvoiceLine>
          <ItemDescription>${item.description}</ItemDescription>
          <Quantity>${item.quantity}</Quantity>
          <UnitPriceWithoutTax>${item.unitPrice.toFixed(
            2
          )}</UnitPriceWithoutTax>
          <TotalCost>${item.subtotal.toFixed(2)}</TotalCost>
          <GrossAmount>${item.total.toFixed(2)}</GrossAmount>
          <TaxesOutputs>
            <TaxOutput>
              <TaxTypeCode>01</TaxTypeCode>
              <TaxRate>${item.taxRate.toFixed(2)}</TaxRate>
              <TaxableBase>
                <TotalAmount>${item.subtotal.toFixed(2)}</TotalAmount>
                <EquivalentInEuros>${item.subtotal.toFixed(
                  2
                )}</EquivalentInEuros>
              </TaxableBase>
              <TaxAmount>${item.taxAmount.toFixed(2)}</TaxAmount>
              <TotalAmount>${item.total.toFixed(2)}</TotalAmount>
            </TaxOutput>
          </TaxesOutputs>
        </InvoiceLine>
        `
          )
          .join('')}
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
      // Crear contenido HTML para la factura (ahora es async)
      const htmlContent = await this.generateInvoiceHTML(invoice);

      // Importar dependencias
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      // Crear un elemento temporal en el DOM para renderizar el HTML
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'fixed';
      tempDiv.style.top = '0';
      tempDiv.style.left = '0';
      tempDiv.style.width = '210mm'; // Ancho A4
      tempDiv.style.padding = '20mm';
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.zIndex = '9999';
      tempDiv.style.visibility = 'visible';
      tempDiv.style.opacity = '1';
      tempDiv.innerHTML = htmlContent;
      document.body.appendChild(tempDiv);

      try {
        // Esperar a que todas las imágenes se carguen completamente
        const images = tempDiv.querySelectorAll('img');
        const imagePromises = Array.from(images).map(
          img =>
            new Promise<void>((resolve, reject) => {
              // Verificar que la imagen tenga un src válido
              if (
                !img.src ||
                img.src.startsWith('data:,') ||
                img.src.length < 100
              ) {
                reject(new Error('Imagen QR inválida'));
                return;
              }

              if (img.complete && img.naturalWidth > 0) {
                resolve();
              } else {
                img.onload = () => {
                  if (img.naturalWidth > 0) {
                    resolve();
                  } else {
                    reject(new Error('Imagen QR no se cargó correctamente'));
                  }
                };
                img.onerror = () => {
                  // Ocultar la imagen si falla
                  img.style.display = 'none';
                  const qrSection = img.closest(
                    '.qr-section'
                  ) as HTMLElement | null;
                  if (qrSection) {
                    qrSection.style.display = 'none';
                  }
                  reject(new Error('Error cargando imagen QR'));
                };
                // Timeout después de 10 segundos
                setTimeout(
                  () => reject(new Error('Timeout cargando imagen QR')),
                  10000
                );
              }
            })
        );

        try {
          await Promise.all(imagePromises);
        } catch (error) {
          console.error('Error cargando imágenes:', error);
          // Continuar de todas formas, pero ocultar las imágenes que fallaron
          images.forEach(img => {
            if (!img.complete || img.naturalWidth === 0) {
              img.style.display = 'none';
              const qrSection = img.closest(
                '.qr-section'
              ) as HTMLElement | null;
              if (qrSection) {
                qrSection.style.display = 'none';
              }
            }
          });
        }

        // Esperar un poco más para asegurar que todo esté renderizado
        await new Promise(resolve => setTimeout(resolve, 500));

        // Convertir HTML a canvas usando html2canvas
        const canvas = await html2canvas(tempDiv, {
          scale: 2,
          useCORS: true,
          logging: false, // Desactivar logging para producción
          backgroundColor: '#ffffff',
          width: tempDiv.scrollWidth,
          height: tempDiv.scrollHeight,
          windowWidth: tempDiv.scrollWidth,
          windowHeight: tempDiv.scrollHeight,
          allowTaint: false,
          imageTimeout: 5000,
        });

        // Verificar que el canvas tenga contenido
        if (canvas.width === 0 || canvas.height === 0) {
          throw new Error(
            'El canvas está vacío. El HTML no se renderizó correctamente.'
          );
        }

        // Crear PDF desde el canvas
        const imgData = canvas.toDataURL('image/png');

        // Verificar que la imagen tenga datos
        if (!imgData || imgData === 'data:,') {
          throw new Error('No se pudo generar la imagen del PDF.');
        }

        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210; // Ancho A4 en mm
        const pageHeight = 297; // Alto A4 en mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        // Añadir primera página
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        // Añadir páginas adicionales si es necesario
        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        // NOTA: El QR ya está incluido en el HTML y por tanto en el canvas/imagen
        // No es necesario agregarlo manualmente, ya que html2canvas lo captura del HTML

        return pdf.output('blob');
      } finally {
        // Limpiar el elemento temporal
        if (document.body.contains(tempDiv)) {
          document.body.removeChild(tempDiv);
        }
      }
    } catch (error) {
      console.error('Error generando PDF de factura:', error);
      throw new Error(
        `No se pudo generar el PDF de la factura: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`
      );
    }
  }

  // Generar código QR como imagen base64
  private async generateQRCodeImage(qrData: string): Promise<string> {
    try {
      const QRCode = (await import('qrcode')).default;
      const qrImageDataUrl = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      // Verificar que la imagen se generó correctamente
      if (
        !qrImageDataUrl ||
        qrImageDataUrl.startsWith('data:,') ||
        qrImageDataUrl.length < 100 ||
        !qrImageDataUrl.startsWith('data:image/png;base64,')
      ) {
        throw new Error('La imagen del QR no se generó correctamente');
      }
      // Verificar que la imagen se puede cargar
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(qrImageDataUrl);
        img.onerror = () =>
          reject(new Error('La imagen del QR no se pudo cargar'));
        img.src = qrImageDataUrl;
      });
    } catch (error) {
      console.error('Error generando código QR:', error);
      // Reintentar una vez más antes de fallar
      try {
        const QRCode = (await import('qrcode')).default;
        const qrImageDataUrl = await QRCode.toDataURL(qrData, {
          errorCorrectionLevel: 'H',
          type: 'image/png',
          width: 200,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        // Verificar que la imagen se puede cargar
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(qrImageDataUrl);
          img.onerror = () =>
            reject(
              new Error('La imagen del QR no se pudo cargar en el reintento')
            );
          img.src = qrImageDataUrl;
        });
      } catch (retryError) {
        console.error('Error en reintento de generación de QR:', retryError);
        throw new Error('No se pudo generar la imagen del código QR');
      }
    }
  }

  // Generar HTML para la factura
  private async generateInvoiceHTML(invoice: Invoice): Promise<string> {
    // Generar datos del código QR según Anexo II del Reglamento
    const qrData = cryptoService.generateQRCodeData(invoice);
    // Generar imagen del código QR
    let qrImageDataUrl: string;
    try {
      qrImageDataUrl = await this.generateQRCodeImage(qrData);

      // Validar que la imagen se generó correctamente
      if (
        !qrImageDataUrl ||
        !qrImageDataUrl.startsWith('data:image/png;base64,') ||
        qrImageDataUrl.length < 500
      ) {
        throw new Error('La imagen del QR no se generó correctamente');
      }

      // Verificar que la imagen se puede cargar creando un objeto Image
      await new Promise<void>((resolve, reject) => {
        const testImg = new Image();
        testImg.onload = () => {
          if (testImg.naturalWidth > 0 && testImg.naturalHeight > 0) {
            resolve();
          } else {
            reject(new Error('La imagen del QR no tiene dimensiones válidas'));
          }
        };
        testImg.onerror = () =>
          reject(new Error('La imagen del QR no se pudo cargar'));
        testImg.src = qrImageDataUrl;
        // Timeout de 5 segundos
        setTimeout(
          () => reject(new Error('Timeout validando imagen QR')),
          5000
        );
      });

      // Guardar la URL de la imagen del QR para usarla después en el PDF
      this.lastQRImageDataUrl = qrImageDataUrl;
    } catch (error) {
      console.error('Error generando imagen QR para factura:', error);
      // Si falla la generación del QR, lanzar error para que se maneje en el nivel superior
      throw new Error(
        `No se pudo generar el código QR de la factura: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`
      );
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 15px; 
            background-color: white;
            color: black;
            font-size: 11px;
            line-height: 1.4;
          }
          .header { 
            text-align: center; 
            margin-bottom: 15px; 
            color: black;
          }
          .header h1 { 
            font-size: 22px; 
            font-weight: bold; 
            margin: 5px 0; 
            color: black;
          }
          .header h2 { 
            font-size: 16px; 
            font-weight: bold; 
            margin: 3px 0; 
            color: black;
          }
          .company-info { 
            margin-bottom: 15px; 
            color: black;
          }
          .company-info h3 {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 5px;
            color: black;
          }
          .company-info p {
            margin: 2px 0;
            font-size: 10px;
            color: black;
          }
          .invoice-details { 
            margin-bottom: 15px; 
            color: black;
          }
          .invoice-details p {
            margin: 3px 0;
            font-size: 10px;
            color: black;
          }
          .patient-info { 
            margin-bottom: 15px; 
            color: black;
          }
          .patient-info h3 {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 5px;
            color: black;
          }
          .patient-info p {
            margin: 2px 0;
            font-size: 10px;
            color: black;
          }
          .items-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 15px; 
            color: black;
            font-size: 10px;
          }
          .items-table th, .items-table td { 
            border: 1px solid #333; 
            padding: 5px; 
            text-align: left; 
            color: black;
            background-color: white;
          }
          .items-table th {
            background-color: #f0f0f0;
            font-weight: bold;
            font-size: 10px;
          }
          .totals { 
            text-align: right; 
            margin-bottom: 12px; 
            color: black;
          }
          .totals p {
            margin: 3px 0;
            font-size: 11px;
            color: black;
          }
          .qr-section { 
            text-align: center; 
            margin: 10px 0; 
            padding: 8px; 
            border: 2px dashed #333; 
            color: black;
            background-color: white;
          }
          .qr-section h4 {
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 6px;
            color: black;
          }
          .qr-section img {
            max-width: 120px;
            height: auto;
            margin: 5px auto;
            display: block;
            border: 2px solid #333;
            padding: 5px;
            background-color: white;
          }
          .qr-section p {
            margin: 5px 0 3px 0;
            color: black;
            font-size: 9px;
          }
          .footer { 
            text-align: center; 
            margin-top: 15px; 
            font-size: 9px; 
            color: black;
            line-height: 1.3;
          }
          .footer p {
            margin: 2px 0;
            color: black;
          }
          strong {
            font-weight: bold;
            color: black;
          }
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
          <p>${invoice.companyInfo.postalCode} ${invoice.companyInfo.city}, ${
      invoice.companyInfo.province
    }</p>
          <p>Tel: ${invoice.companyInfo.phone} | Email: ${
      invoice.companyInfo.email
    }</p>
        </div>
        
        <div class="invoice-details">
          <p><strong>Fecha de emisión:</strong> ${invoice.invoiceDate.toLocaleDateString(
            'es-ES'
          )}</p>
          <p><strong>Fecha de vencimiento:</strong> ${
            invoice.status === 'paid'
              ? 'Pago efectuado'
              : invoice.dueDate.toLocaleDateString('es-ES')
          }</p>
        </div>
        
        <div class="patient-info">
          <h3>Cliente</h3>
          <p><strong>${invoice.patientInfo.name} ${
      invoice.patientInfo.surname
    }</strong></p>
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
            ${invoice.items
              .map(
                item => `
              <tr>
                <td>${item.description}</td>
                <td>${item.quantity}</td>
                <td>${item.unitPrice.toFixed(2)}€</td>
                <td>${item.subtotal.toFixed(2)}€</td>
                <td>${item.taxAmount.toFixed(2)}€</td>
                <td>${item.total.toFixed(2)}€</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
        
        <div class="totals">
          <p><strong>Subtotal:</strong> ${invoice.subtotal.toFixed(2)}€</p>
          ${
            invoice.taxAmount > 0
              ? `<p><strong>IVA (${
                  invoice.items[0]?.taxRate?.toFixed(0) || 0
                }%):</strong> ${invoice.taxAmount.toFixed(2)}€</p>`
              : '<p><strong>IVA:</strong> Exento (Asistencia sanitaria)</p>'
          }
          <p><strong>TOTAL:</strong> ${invoice.total.toFixed(2)}€</p>
        </div>
        
        <!-- Código QR según Anexo II del Reglamento Verifactu -->
        <div class="qr-section" style="text-align: center; margin: 10px 0; padding: 8px; border: 2px dashed #333;">
          <h4 style="font-size: 12px; font-weight: bold; margin-bottom: 6px;">Código QR Verifactu</h4>
          <div style="display: flex; justify-content: center; align-items: center; min-height: 120px; width: 100%;">
            <img 
              src="${qrImageDataUrl}" 
              alt="QR Code" 
              style="max-width: 120px; height: auto; display: block; border: 2px solid #333; padding: 5px; background-color: white; object-fit: contain;" 
              crossorigin="anonymous"
              onerror="this.onerror=null; this.style.display='none';"
            />
          </div>
          <p style="font-size: 9px; color: #666; margin-top: 5px;">
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

  // Convertir datos de Firestore a Invoice (convertir Timestamps a Date)
  private convertFirestoreInvoice(data: any): Invoice {
    const convertDate = (dateValue: any): Date => {
      if (!dateValue) return new Date();
      if (dateValue.toDate && typeof dateValue.toDate === 'function') {
        return dateValue.toDate();
      }
      if (dateValue instanceof Date) {
        return dateValue;
      }
      return new Date(dateValue);
    };

    return {
      ...data,
      invoiceDate: convertDate(data.invoiceDate),
      dueDate: convertDate(data.dueDate),
      paymentDate: data.paymentDate ? convertDate(data.paymentDate) : undefined,
      createdAt: convertDate(data.createdAt),
      updatedAt: convertDate(data.updatedAt),
      companyInfo: {
        ...data.companyInfo,
        createdAt: convertDate(data.companyInfo?.createdAt),
        updatedAt: convertDate(data.companyInfo?.updatedAt),
      },
      auditTrail: (data.auditTrail || []).map((log: any) => ({
        ...log,
        timestamp: convertDate(log.timestamp),
      })),
    };
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
      return querySnapshot.docs.map(doc =>
        this.convertFirestoreInvoice({ ...doc.data(), id: doc.id })
      );
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
        return this.convertFirestoreInvoice({
          ...docSnap.data(),
          id: docSnap.id,
        });
      }

      return null;
    } catch (error) {
      console.error('Error obteniendo factura:', error);
      throw new Error('No se pudo obtener la factura');
    }
  }

  // Actualizar estado de factura
  async updateInvoiceStatus(
    invoiceId: string,
    status: Invoice['status']
  ): Promise<void> {
    try {
      const docRef = doc(db, 'invoices', invoiceId);
      await updateDoc(docRef, {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error actualizando estado de factura:', error);
      throw new Error('No se pudo actualizar el estado de la factura');
    }
  }

  // Marcar factura como pagada
  async markInvoiceAsPaid(
    invoiceId: string,
    paymentMethod: string
  ): Promise<void> {
    try {
      const docRef = doc(db, 'invoices', invoiceId);
      await updateDoc(docRef, {
        status: 'paid',
        paymentMethod,
        paymentDate: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error marcando factura como pagada:', error);
      throw new Error('No se pudo marcar la factura como pagada');
    }
  }

  // Actualizar estado de facturación en registro médico
  private async updateMedicalRecordInvoiceStatus(
    medicalRecordId: string,
    invoiceIssued: boolean
  ): Promise<void> {
    try {
      const docRef = doc(db, 'medicalRecords', medicalRecordId);
      await updateDoc(docRef, {
        invoiceIssued,
        updatedAt: serverTimestamp(),
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
      await this.addAuditLog(
        invoiceId,
        'exported',
        'Factura exportada para la AEAT'
      );

      return signedXML;
    } catch (error) {
      console.error('Error exportando factura para AEAT:', error);
      throw new Error('No se pudo exportar la factura para la AEAT');
    }
  }

  // Añadir log de auditoría criptográficamente seguro
  private async addAuditLog(
    invoiceId: string,
    action: AuditLog['action'],
    details: string
  ): Promise<void> {
    try {
      const docRef = doc(db, 'invoices', invoiceId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const invoice = docSnap.data() as Invoice;

        // Obtener el último hash para continuar la cadena
        let previousHash = '';
        if (invoice.auditTrail.length > 0) {
          const lastEvent = invoice.auditTrail[invoice.auditTrail.length - 1];
          previousHash = lastEvent.hash;
        }

        // Crear log seguro con el hash anterior correcto
        const auditLog = await cryptoService.createSecureAuditLog(
          action,
          invoice.userId,
          invoice.companyInfo.email,
          details,
          this.getClientIP(),
          navigator.userAgent,
          previousHash // Pasar el hash anterior explícitamente
        );

        invoice.auditTrail.push(auditLog);

        await updateDoc(docRef, {
          auditTrail: invoice.auditTrail,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error añadiendo log de auditoría:', error);
    }
  }

  // Guardar borrador de factura
  async saveDraft(
    userId: string,
    medicalRecordId: string,
    companyInfo: CompanyInfo,
    items: Omit<InvoiceItem, 'id' | 'subtotal' | 'taxAmount' | 'total'>[],
    options?: {
      isPaid?: boolean;
      paymentMethod?: string;
    }
  ): Promise<string> {
    try {
      const draftRef = collection(db, 'invoiceDrafts');
      const draftQuery = query(
        draftRef,
        where('userId', '==', userId),
        where('medicalRecordId', '==', medicalRecordId)
      );

      const querySnapshot = await getDocs(draftQuery);

      const draftData: Omit<InvoiceDraft, 'id'> = {
        userId,
        medicalRecordId,
        companyInfo,
        items,
        isPaid: options?.isPaid,
        paymentMethod: options?.paymentMethod,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (!querySnapshot.empty) {
        // Actualizar borrador existente
        const existingDraft = querySnapshot.docs[0];
        await updateDoc(doc(db, 'invoiceDrafts', existingDraft.id), {
          ...draftData,
          updatedAt: serverTimestamp(),
        });
        return existingDraft.id;
      } else {
        // Crear nuevo borrador
        const docRef = await addDoc(draftRef, {
          ...draftData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return docRef.id;
      }
    } catch (error) {
      console.error('Error guardando borrador:', error);
      throw new Error('No se pudo guardar el borrador');
    }
  }

  // Cargar borrador de factura
  async loadDraft(
    userId: string,
    medicalRecordId: string
  ): Promise<InvoiceDraft | null> {
    try {
      const draftRef = collection(db, 'invoiceDrafts');
      const draftQuery = query(
        draftRef,
        where('userId', '==', userId),
        where('medicalRecordId', '==', medicalRecordId),
        orderBy('updatedAt', 'desc'),
        limit(1)
      );

      const querySnapshot = await getDocs(draftQuery);

      if (querySnapshot.empty) {
        return null;
      }

      const draftDoc = querySnapshot.docs[0];
      const draftData = draftDoc.data();

      return {
        id: draftDoc.id,
        userId: draftData.userId,
        medicalRecordId: draftData.medicalRecordId,
        companyInfo: draftData.companyInfo,
        items: draftData.items,
        isPaid: draftData.isPaid,
        paymentMethod: draftData.paymentMethod,
        createdAt: draftData.createdAt?.toDate() || new Date(),
        updatedAt: draftData.updatedAt?.toDate() || new Date(),
      };
    } catch (error) {
      console.error('Error cargando borrador:', error);
      return null;
    }
  }

  // Eliminar borrador de factura
  async deleteDraft(userId: string, medicalRecordId: string): Promise<void> {
    try {
      const draftRef = collection(db, 'invoiceDrafts');
      const draftQuery = query(
        draftRef,
        where('userId', '==', userId),
        where('medicalRecordId', '==', medicalRecordId)
      );

      const querySnapshot = await getDocs(draftQuery);

      if (!querySnapshot.empty) {
        const draftDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, 'invoiceDrafts', draftDoc.id), {
          deletedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error eliminando borrador:', error);
      // No lanzar error, es solo limpieza
    }
  }

  // Renumerar facturas del año actual (global para todo el servicio)
  // Nota: El parámetro userId se mantiene por compatibilidad pero ya no se usa
  async renumberInvoices(
    userId: string
  ): Promise<{ success: boolean; message: string; renumbered: number }> {
    try {
      const year = new Date().getFullYear();
      const yearPrefix = year.toString().slice(-2);

      // Obtener todas las facturas ordenadas por fecha de creación (sin filtrar por usuario)
      // La numeración es global para todo el servicio
      const invoicesRef = collection(db, 'invoices');
      const q = query(invoicesRef, orderBy('createdAt', 'asc'));

      const querySnapshot = await getDocs(q);

      // Filtrar solo las facturas del año actual
      const invoicesToRenumber: Array<{
        id: string;
        invoice: Invoice;
        createdAt: Date;
      }> = [];

      querySnapshot.docs.forEach(docSnap => {
        const invoiceData = docSnap.data();
        const invoice = this.convertFirestoreInvoice({
          ...invoiceData,
          id: docSnap.id,
        });

        // Verificar si la factura es del año actual (por número o por fecha)
        const invoiceYear = invoice.invoiceDate.getFullYear();
        const invoiceNumberYear = invoice.invoiceNumber.match(/^(\d{2})-/)?.[1];

        if (invoiceYear === year || invoiceNumberYear === yearPrefix) {
          invoicesToRenumber.push({
            id: docSnap.id,
            invoice,
            createdAt: invoice.createdAt,
          });
        }
      });

      // Ordenar por fecha de creación
      invoicesToRenumber.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );

      // Renumerar secuencialmente
      let renumberedCount = 0;
      for (let i = 0; i < invoicesToRenumber.length; i++) {
        const newNumber = `${yearPrefix}-${(i + 1)
          .toString()
          .padStart(4, '0')}`;
        const invoiceDoc = invoicesToRenumber[i];

        // Solo actualizar si el número es diferente
        if (invoiceDoc.invoice.invoiceNumber !== newNumber) {
          await updateDoc(doc(db, 'invoices', invoiceDoc.id), {
            invoiceNumber: newNumber,
            updatedAt: serverTimestamp(),
          });
          renumberedCount++;
        }
      }

      return {
        success: true,
        message: `Se renumeraron ${renumberedCount} facturas correctamente`,
        renumbered: renumberedCount,
      };
    } catch (error) {
      console.error('Error renumerando facturas:', error);
      return {
        success: false,
        message: `Error al renumerar facturas: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`,
        renumbered: 0,
      };
    }
  }

  // Eliminar factura
  async deleteInvoice(invoiceId: string): Promise<void> {
    try {
      const docRef = doc(db, 'invoices', invoiceId);
      await updateDoc(docRef, {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });

      // Añadir log de auditoría
      await this.addAuditLog(invoiceId, 'cancelled', 'Factura eliminada');
    } catch (error) {
      console.error('Error eliminando factura:', error);
      throw new Error('No se pudo eliminar la factura');
    }
  }
}

export const invoiceService = InvoiceService.getInstance();
