import jsPDF from 'jspdf';
import { PDFDocument } from 'pdf-lib-with-encrypt';
import { MedicalRecord } from '../types';
import { emailService } from './emailService';
import { storageService } from './firebase';

class PDFService {
  // Generar contraseña basada en el DNI
  generatePassword(dni: string): string {
    // Extraer los últimos 3 dígitos y la letra del DNI
    const match = dni.match(/(\d{3})([A-Z])$/);
    if (match) {
      return match[1] + match[2]; // últimos 3 dígitos + letra
    }
    // Fallback si no coincide el patrón
    return dni.slice(-4); // últimos 4 caracteres
  }

  // Cargar imagen y obtener dimensiones
  async loadImage(src: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  // Calcular dimensiones manteniendo proporción
  calculateImageDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    const ratio = Math.min(maxWidth / originalWidth, maxHeight / originalHeight);
    return {
      width: originalWidth * ratio,
      height: originalHeight * ratio
    };
  }

  // Generar PDF sin contraseña (para uso interno)
  async generatePDF(record: MedicalRecord): Promise<File> {
    const doc = new jsPDF();
    
    // Configuración de márgenes
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - (margin * 2);
    let yPosition = margin;

    // Logo y encabezado
    try {
      let logoPath = '/LOGO DEFINITIVO.png'; // Logo por defecto
      
      // Seleccionar el logo según el tipo de informe
      if (record.reportType === 'Geneped') {
        logoPath = '/logo.png';
      } else if (record.reportType === 'Medicaes') {
        logoPath = '/Medicaes.png';
      }
      
      const logoResponse = await fetch(logoPath);
      const logoBlob = await logoResponse.blob();
      const logoArrayBuffer = await logoBlob.arrayBuffer();
      const logoBase64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(logoArrayBuffer))));
      
      // Crear una imagen temporal para obtener las dimensiones originales
      const img = new Image();
      img.src = `data:image/png;base64,${logoBase64}`;
      
      await new Promise((resolve) => {
        img.onload = () => {
          // Calcular dimensiones manteniendo proporciones originales
          const maxWidth = 80; // Ancho máximo
          const maxHeight = 40; // Alto máximo
          
          const { width, height } = this.calculateImageDimensions(
            img.width,
            img.height,
            maxWidth,
            maxHeight
          );
          
          // Centrar el logo horizontalmente
          const logoX = (pageWidth - width) / 2;
          
          doc.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', logoX, yPosition, width, height);
          resolve(null);
        };
      });
    } catch (error) {
      console.warn('No se pudo cargar el logo:', error);
    }

    // Título del informe
    yPosition += 45;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORME CLÍNICO', pageWidth / 2, yPosition, { align: 'center' });

    // Información del paciente
    yPosition += 20;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL PACIENTE:', margin, yPosition);
    
    yPosition += 10;
    doc.setFont('helvetica', 'normal');
    doc.text(`Nombre: ${record.patientName} ${record.patientSurname}`, margin, yPosition);
    
    yPosition += 8;
    doc.text(`DNI: ${record.patientDni}`, margin, yPosition);
    
    yPosition += 8;
    doc.text(`Fecha de nacimiento: ${record.patientBirthDate}`, margin, yPosition);

    // Tipo de informe
    yPosition += 15;
    doc.setFont('helvetica', 'bold');
    doc.text(`Tipo de informe: ${record.reportType}`, margin, yPosition);

    // Informe clínico
    yPosition += 15;
    doc.setFont('helvetica', 'bold');
    doc.text('INFORME CLÍNICO:', margin, yPosition);
    
    yPosition += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    
    // Convertir HTML a texto plano para el PDF
    const plainText = this.convertFormattedTextToPlainText(record.report);
    const reportLines = doc.splitTextToSize(plainText, contentWidth);
    
    for (const line of reportLines) {
      // Verificar si necesitamos una nueva página
      if (yPosition > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text(line, margin, yPosition);
      yPosition += 6; // Espaciado entre líneas
    }

    // Pruebas solicitadas (solo si existen)
    if (record.requestedTests && record.requestedTests.trim() !== '') {
      yPosition += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('PRUEBAS SOLICITADAS:', margin, yPosition);
      
      yPosition += 10;
      doc.setFont('helvetica', 'normal');
      const testsLines = doc.splitTextToSize(record.requestedTests, contentWidth);
      
      for (const line of testsLines) {
        if (yPosition > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          yPosition = margin;
        }
        doc.text(line, margin, yPosition);
        yPosition += 6;
      }
    }

    // Documentos adjuntos (solo si existen)
    if (record.uploadedDocuments && record.uploadedDocuments.length > 0) {
      yPosition += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('DOCUMENTOS ADJUNTOS:', margin, yPosition);
      
      yPosition += 10;
      doc.setFont('helvetica', 'normal');
      
      record.uploadedDocuments.forEach((url, index) => {
        const fileName = url.split('/').pop() || `Documento ${index + 1}`;
        if (yPosition > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          yPosition = margin;
        }
        doc.text(`• ${fileName}`, margin, yPosition);
        yPosition += 6;
      });
    }

    // Fecha del informe
    yPosition += 15;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const currentDate = new Date().toLocaleDateString('es-ES');
    doc.text(`Fecha del informe: ${currentDate}`, margin, yPosition);

    // Generar el archivo PDF
    const pdfBlob = doc.output('blob');
    const filename = `Informe_${record.patientName}_${record.patientSurname}_${currentDate.replace(/\//g, '-')}.pdf`;
    
    return new File([pdfBlob], filename, { type: 'application/pdf' });
  }

  // Proteger PDF subido directamente
  async generateProtectedPDFFromFile(file: File, password: string): Promise<File> {
    try {
      // Leer el archivo PDF
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      // Proteger el PDF con contraseña usando la API correcta
      pdfDoc.encrypt({
        userPassword: password,
        ownerPassword: password,
        permissions: {
          printing: 'lowResolution',
          modifying: false,
          copying: false,
          annotating: false,
          fillingForms: false,
          contentAccessibility: false,
          documentAssembly: false
        }
      });

      // Guardar PDF protegido
      const protectedPdfBytes = await pdfDoc.save();

      // Crear archivo protegido
      const protectedBlob = new Blob([protectedPdfBytes], { type: 'application/pdf' });
      const filename = file.name.replace('.pdf', '_protegido.pdf');
      
      return new File([protectedBlob], filename, { type: 'application/pdf' });
    } catch (error) {
      console.error('Error protegiendo PDF:', error);
      throw new Error('Error protegiendo PDF');
    }
  }

  // Generar PDF protegido con contraseña
  async generateProtectedPDF(record: MedicalRecord): Promise<File> {
    try {
      // Primero generar el PDF sin contraseña
      const unprotectedPDF = await this.generatePDF(record);
      
      // Luego protegerlo con contraseña
      const password = this.generatePassword(record.patientDni);
      const protectedPDF = await this.generateProtectedPDFFromFile(unprotectedPDF, password);
      
      return protectedPDF;
    } catch (error) {
      console.error('Error generando PDF protegido:', error);
      throw new Error('Error generando PDF protegido');
    }
  }

  // Descargar PDF
  downloadPDF(file: File): void {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Enviar PDF protegido por email
  async sendProtectedPDFByEmail(
    record: MedicalRecord,
    recipientEmail: string,
    userEmail: string
  ): Promise<void> {
    try {
      // Generar PDF protegido
      const pdfFile = await this.generateProtectedPDF(record);
      const password = this.generatePassword(record.patientDni);

      // Subir PDF a Firebase Storage usando la estructura documents/{patientId}/pdfs/...
      const fileName = `documents/${record.patientId}/pdfs/${record.patientDni}_${Date.now()}.pdf`;
      const downloadURL = await storageService.uploadFile(pdfFile, fileName);

      // Enviar email con enlace de descarga
      await emailService.sendEmailWithDownloadLink(
        record,
        recipientEmail,
        userEmail,
        downloadURL,
        password
      );

    } catch (error) {
      console.error('Error enviando PDF por email:', error);
      throw new Error('Error enviando PDF por email');
    }
  }

  // Función para convertir HTML a texto plano
  private convertHtmlToPlainText(html: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Procesar elementos específicos
    const paragraphs = tempDiv.querySelectorAll('p');
    paragraphs.forEach(p => {
      // Asegurar que los párrafos tengan el formato correcto
      p.style.textAlign = 'justify';
      p.style.marginBottom = '0.5em';
    });
    
    // Convertir a texto manteniendo estructura
    let plainText = tempDiv.textContent || tempDiv.innerText || '';
    
    // Limpiar espacios extra y normalizar
    plainText = plainText
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n') // Eliminar líneas vacías múltiples
      .trim();
    
    return plainText;
  }

  // Función para convertir formato markdown y HTML a texto plano
  private convertFormattedTextToPlainText(text: string): string {
    // Si el texto contiene HTML (del editor profesional), procesarlo
    if (text.includes('<') && text.includes('>')) {
      return this.convertHtmlToPlainText(text);
    }
    
    // Si es texto con formato markdown simple, procesarlo
    let plainText = text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1') // Italic
      .replace(/__(.*?)__/g, '$1'); // Underline
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = plainText;
    plainText = tempDiv.textContent || tempDiv.innerText || '';
    
    plainText = plainText.replace(/\s+/g, ' ').trim();
    
    return plainText;
  }
}

export const pdfService = new PDFService(); 