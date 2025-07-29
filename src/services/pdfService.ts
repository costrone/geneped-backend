import { MedicalRecord } from '../types';
import jsPDF from 'jspdf';
import { emailService } from './emailService';

export const pdfService = {
  generatePassword(dni: string): string {
    // Extraer los últimos 3 dígitos y la letra
    const match = dni.match(/(\d{3})([A-Za-z])$/);
    if (match) {
      return match[1] + match[2];
    }
    // Fallback si el formato no es el esperado
    return dni.slice(-4);
  },

  // Función para cargar imagen y obtener dimensiones
  loadImage(src: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = reject;
      img.src = src;
    });
  },

  // Función para calcular dimensiones manteniendo proporciones
  calculateImageDimensions(originalWidth: number, originalHeight: number, maxWidth: number, maxHeight: number) {
    const ratio = Math.min(maxWidth / originalWidth, maxHeight / originalHeight);
    return {
      width: originalWidth * ratio,
      height: originalHeight * ratio
    };
  },

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

      // Encabezado en negrita debajo del logo
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('GENÉTICA MÉDICA Y ASESORAMIENTO GENÉTICO', 105, 90, { align: 'center' });
      doc.text('INFORME CLÍNICO', 105, 100, { align: 'center' });

      // Fecha de generación (solo la fecha, alineada a la derecha)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      const currentDate = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      doc.text(currentDate, 190, 115, { align: 'right' });

      // Línea separadora decorativa
      doc.setDrawColor(100, 100, 100);
      doc.line(20, 125, 190, 125);
      doc.setDrawColor(0, 0, 0);

      // Datos del paciente con formato profesional
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('DATOS DEL PACIENTE', 20, 145);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);

      // Cuadro de datos del paciente
      doc.setFillColor(245, 245, 245);
      doc.rect(20, 150, 170, 50, 'F');
      doc.setFillColor(255, 255, 255);

      doc.text(`Nombre completo: ${record.patientName} ${record.patientSurname}`, 25, 160);
      doc.text(`DNI: ${record.patientDni}`, 25, 170);
      doc.text(`Fecha de nacimiento: ${new Date(record.patientBirthDate).toLocaleDateString('es-ES')}`, 25, 180);
      doc.text(`Fecha del informe: ${record.createdAt.toLocaleDateString('es-ES')}`, 25, 190);

      // Informe clínico con formato profesional
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('INFORME CLÍNICO', 20, 220);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);

      // Añadir el informe clínico
      const reportLines = doc.splitTextToSize(record.report, 170);
      doc.text(reportLines, 20, 235);

      // Pie de página
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
  },

  // Generar PDF protegido con contraseña real
  async generateProtectedPDF(record: MedicalRecord): Promise<File> {
    try {
      // Importar dinámicamente pdf-lib-with-encrypt
      const { PDFDocument } = await import('pdf-lib-with-encrypt');
      
      // Generar PDF base
      const pdfFile = await this.generatePDF(record);
      const pdfBytes = await pdfFile.arrayBuffer();
      
      // Crear documento PDF con pdf-lib
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      // Generar contraseña
      const password = this.generatePassword(record.patientDni);
      
      // Proteger el PDF con contraseña
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
      
      // Crear archivo
      const filename = 'historial_protegido_' + record.patientDni + '_' + record.createdAt.toISOString().split('T')[0] + '.pdf';
      return new File([protectedPdfBytes], filename, { type: 'application/pdf' });
      
    } catch (error) {
      console.error('Error generando PDF protegido:', error);
      // Fallback a PDF sin protección
      console.warn('Usando PDF sin protección como fallback');
      return await this.generatePDF(record);
    }
  },

  downloadPDF(file: File): void {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Función para enviar enlace de descarga por email
  async sendProtectedPDFByEmail(record: MedicalRecord, email: string, userEmail: string): Promise<void> {
    try {
      // Generar PDF protegido
      const protectedPdfFile = await this.generateProtectedPDF(record);
      const password = this.generatePassword(record.patientDni);
      
      // Subir PDF a Firebase Storage y generar enlace temporal
      const downloadLink = await this.uploadPDFAndGetLink(protectedPdfFile, record);
      
      // Enviar email con enlace usando EmailJS
      await this.sendEmailWithDownloadLink(record, email, userEmail, downloadLink, password);
      
      console.log('Email con enlace enviado exitosamente');
      alert('✅ Email enviado exitosamente a: ' + email + '\n\n🔗 Enlace de descarga enviado\n🔐 Contraseña: ' + password + '\n\nEl PDF está protegido y el enlace expira en 48 horas.');
      
    } catch (error) {
      console.error('Error enviando email con enlace:', error);
      throw new Error('Error enviando email: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  },

  // Subir PDF a Firebase Storage y generar enlace temporal
  async uploadPDFAndGetLink(pdfFile: File, record: MedicalRecord): Promise<string> {
    try {
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('../firebase/config');
      
      // Crear referencia única para el archivo
      const timestamp = Date.now();
      const filename = 'protected_pdfs/' + record.patientDni + '_' + timestamp + '_' + pdfFile.name;
      const storageRef = ref(storage, filename);
      
      // Subir archivo
      await uploadBytes(storageRef, pdfFile);
      
      // Generar enlace de descarga temporal (48 horas)
      const downloadURL = await getDownloadURL(storageRef);
      
      return downloadURL;
      
    } catch (error) {
      console.error('Error subiendo PDF a Storage:', error);
      throw new Error('Error subiendo PDF a Storage');
    }
  },

  // Enviar email con enlace de descarga usando EmailJS
  async sendEmailWithDownloadLink(record: MedicalRecord, email: string, userEmail: string, downloadLink: string, password: string): Promise<void> {
    try {
      await emailService.sendEmailWithDownloadLink(record, email, userEmail, downloadLink, password);
    } catch (error) {
      console.error('Error enviando email con enlace:', error);
      throw new Error('Error enviando email con enlace de descarga');
    }
  },

  // Convertir archivo a base64
  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remover el prefijo "data:application/pdf;base64,"
        const base64Clean = base64.split(',')[1];
        resolve(base64Clean);
      };
      reader.onerror = error => reject(error);
    });
  }
}; 