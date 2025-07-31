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
    try {
      const doc = new jsPDF();
      doc.setFont('helvetica');

      // Cargar y añadir logo con proporciones correctas
      let logoWidth = 50;
      let logoHeight = 50;
      let logoX = 75;

      try {
        const logoPath = record.reportType === 'Geneped' ? '/logo.png' : '/Medicaes.png';
        const dimensions = await this.loadImage(logoPath);
        const calculatedDimensions = this.calculateImageDimensions(dimensions.width, dimensions.height, 60, 60);

        logoWidth = calculatedDimensions.width;
        logoHeight = calculatedDimensions.height;
        logoX = 105 - (logoWidth / 2); // Centrar el logo
      } catch (error) {
        console.warn('No se pudo cargar la imagen del logo, usando dimensiones por defecto');
      }

      // Añadir logo con dimensiones calculadas
      if (record.reportType === 'Geneped') {
        doc.addImage('/logo.png', 'PNG', logoX, 20, logoWidth, logoHeight);
      } else if (record.reportType === 'Medicaes') {
        doc.addImage('/Medicaes.png', 'PNG', logoX, 20, logoWidth, logoHeight);
      }

      // Encabezado en negrita más cerca del logo
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('GENÉTICA MÉDICA Y ASESORAMIENTO GENÉTICO', 105, 75, { align: 'center' });
      doc.text('INFORME CLÍNICO', 105, 85, { align: 'center' });

      // Fecha de generación (solo la fecha, alineada a la derecha)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      const currentDate = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      doc.text(currentDate, 190, 95, { align: 'right' });

      // Línea separadora decorativa
      doc.setDrawColor(100, 100, 100);
      doc.line(20, 105, 190, 105);
      doc.setDrawColor(0, 0, 0);

      // Datos del paciente con formato profesional
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('DATOS DEL PACIENTE', 20, 125);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);

      // Cuadro de datos del paciente
      doc.setFillColor(245, 245, 245);
      doc.rect(20, 130, 170, 50, 'F');
      doc.setFillColor(255, 255, 255);

      doc.text(`Nombre completo: ${record.patientName} ${record.patientSurname}`, 25, 140);
      doc.text(`DNI: ${record.patientDni}`, 25, 150);
      doc.text(`Fecha de nacimiento: ${new Date(record.patientBirthDate).toLocaleDateString('es-ES')}`, 25, 160);
      doc.text(`Fecha del informe: ${record.createdAt.toLocaleDateString('es-ES')}`, 25, 170);

      let currentY = 200;

      // Pruebas solicitadas (si existen)
      if (record.requestedTests) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('PRUEBAS SOLICITADAS', 20, currentY);
        currentY += 15;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        
        const testsLines = doc.splitTextToSize(record.requestedTests, 170);
        testsLines.forEach((line: string) => {
          doc.text(line, 20, currentY);
          currentY += 5;
        });
        
        currentY += 10;
      }

      // Documentos adjuntos (si existen)
      if (record.uploadedDocuments && record.uploadedDocuments.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('DOCUMENTOS ADJUNTOS', 20, currentY);
        currentY += 15;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        
        record.uploadedDocuments.forEach((url: string, index: number) => {
          const fileName = url.split('/').pop() || `Documento ${index + 1}`;
          doc.text(`• ${fileName}`, 20, currentY);
          currentY += 5;
        });
        
        currentY += 10;
      }

      // Estado de facturación (si existe)
      if (record.invoiceIssued !== undefined || record.paid !== undefined) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('ESTADO DE FACTURACIÓN', 20, currentY);
        currentY += 15;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        
        if (record.invoiceIssued !== undefined) {
          doc.text(`• Factura emitida: ${record.invoiceIssued ? 'Sí' : 'No'}`, 20, currentY);
          currentY += 5;
        }
        
        if (record.paid !== undefined) {
          doc.text(`• Pagado: ${record.paid ? 'Sí' : 'No'}`, 20, currentY);
          currentY += 5;
        }
        
        currentY += 10;
      }

      // Informe clínico con formato profesional
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('INFORME CLÍNICO', 20, currentY);
      currentY += 15;

      doc.setFont('times', 'normal');
      doc.setFontSize(11);

      // Añadir el informe clínico con paginación automática
      const reportLines = doc.splitTextToSize(record.report, 170);
      
      // Función para añadir texto con paginación automática
      const addTextWithPagination = (text: string[], startY: number) => {
        let currentY = startY;
        const lineHeight = 5; // Espaciado sencillo (reducido de 8 a 5)
        const maxY = 270; // Altura máxima antes de nueva página
        
        // Configurar fuente Times New Roman para el texto del informe
        doc.setFont('times', 'normal');
        doc.setFontSize(11);
        
        for (let i = 0; i < text.length; i++) {
          const line = text[i];
          
          // Si no hay espacio suficiente en la página actual, crear nueva página
          if (currentY + lineHeight > maxY) {
            doc.addPage();
            currentY = 20; // Comenzar desde arriba en la nueva página
            
            // Añadir encabezado en páginas adicionales
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text('INFORME CLÍNICO - Continuación', 20, 15);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(12);
            currentY = 25; // Espacio después del encabezado
          }
          
          // Aplicar justificación al texto
          const words = line.split(' ');
          if (words.length > 1) {
            // Calcular espaciado para justificación
            const lineWidth = doc.getTextWidth(line);
            const spaceWidth = (170 - lineWidth) / (words.length - 1);
            let xPos = 20;
            
            for (const word of words) {
              doc.text(word, xPos, currentY);
              xPos += doc.getTextWidth(word) + spaceWidth;
            }
          } else {
            // Línea con una sola palabra, alinear a la izquierda
            doc.text(line, 20, currentY);
          }
          
          currentY += lineHeight;
        }
        
        return currentY; // Retornar la posición Y final para el pie de página
      };
      
      // Añadir el informe con paginación
      addTextWithPagination(reportLines, currentY);
      
      // Pie de página en la última página
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 280, 190, 280);
      doc.setDrawColor(0, 0, 0);
      doc.text('Documento generado por Geneped - Sistema de Gestión de Historiales', 105, 285, { align: 'center' });

      // Generar archivo
      const pdfBlob = doc.output('blob');
      const filename = 'historial_' + record.patientDni + '_' + record.createdAt.toISOString().split('T')[0] + '.pdf';

      return new File([pdfBlob], filename, { type: 'application/pdf' });
    } catch (error) {
      console.error('Error generando PDF:', error);
      throw new Error('Error generando PDF');
    }
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

      // Subir PDF a Firebase Storage
      const fileName = `pdfs/${record.patientDni}_${Date.now()}.pdf`;
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
}

export const pdfService = new PDFService(); 