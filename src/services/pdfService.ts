import { MedicalRecord } from '../types';
import jsPDF from 'jspdf';
import { emailService } from './emailService';

export const pdfService = {
  generatePassword(dni: string): string {
    const lastThreeDigits = dni.slice(-3);
    const letter = dni.slice(-1);
    return lastThreeDigits + letter;
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

  // Generar PDF sin contraseña
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

      // Dividir el texto en líneas con mejor formato
      const words = record.report.split(' ');
      let line = '';
      let y = 235;
      const maxWidth = 170;
      const lineHeight = 8;

      for (const word of words) {
        const testLine = line + word + ' ';
        const testWidth = doc.getTextWidth(testLine);

        if (testWidth > maxWidth && line !== '') {
          doc.text(line, 20, y);
          line = word + ' ';
          y += lineHeight;

          if (y > 270) break; // Evitar que el texto se salga de la página
        } else {
          line = testLine;
        }
      }

      // Dibujar la última línea
      if (line) {
        doc.text(line, 20, y);
      }

      // Pie de página
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 280, 190, 280);
      doc.setDrawColor(0, 0, 0);
      doc.text('Documento generado por Geneped - Sistema de Gestión de Historiales', 105, 285, { align: 'center' });

      // Generar archivo
      const pdfBlob = doc.output('blob');
      const filename = `historial_${record.patientDni}_${record.createdAt.toISOString().split('T')[0]}.pdf`;

      return new File([pdfBlob], filename, { type: 'application/pdf' });
    } catch (error) {
      console.error('Error generando PDF:', error);
      throw new Error('Error generando PDF');
    }
  },

  // Función para generar PDF protegido (mantener para compatibilidad)
  async generateProtectedPDF(record: MedicalRecord): Promise<{ file: File; password: string }> {
    const file = await this.generatePDF(record);
    const password = this.generatePassword(record.patientDni);
    
    return {
      file,
      password
    };
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

  // Función para enviar PDF por email con EmailJS
  async sendProtectedPDFByEmail(record: MedicalRecord, email: string, userEmail: string): Promise<void> {
    try {
      // Verificar si EmailJS está configurado
      if (!emailService.isConfigured()) {
        // Fallback al método anterior si EmailJS no está configurado
        await this.sendProtectedPDFByEmailFallback(record, email, userEmail);
        return;
      }

      // Generar PDF
      const pdfFile = await this.generatePDF(record);
      
      // Enviar email con EmailJS
      await emailService.sendProtectedPDF(record, email, userEmail, pdfFile);
      
      // Mostrar confirmación
      alert(`✅ Email enviado exitosamente a: ${email}\n\n📧 El PDF protegido ha sido enviado con la contraseña incluida.`);
      
    } catch (error) {
      console.error('Error enviando PDF por email:', error);
      
      // Intentar fallback si EmailJS falla
      try {
        await this.sendProtectedPDFByEmailFallback(record, email, userEmail);
      } catch (fallbackError) {
        throw new Error(`Error enviando email: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      }
    }
  },

  // Método fallback usando mailto (método anterior)
  async sendProtectedPDFByEmailFallback(record: MedicalRecord, email: string, userEmail: string): Promise<void> {
    try {
      // Generar PDF
      const pdfFile = await this.generatePDF(record);
      const password = this.generatePassword(record.patientDni);
      
      // Crear el contenido del email
      const subject = `Informe Clínico - ${record.patientName} ${record.patientSurname}`;
      const body = `
Estimado/a,

Adjunto encontrará el informe clínico del paciente ${record.patientName} ${record.patientSurname} (DNI: ${record.patientDni}).

El documento está protegido con contraseña por motivos de confidencialidad.

🔐 Contraseña del PDF: ${password}

La contraseña está formada por los últimos 3 dígitos del DNI seguidos de la letra.

Saludos cordiales,
${userEmail}
Geneped - Sistema de Gestión de Historiales
      `;

      // Crear enlace mailto
      const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      // Abrir el cliente de email del usuario
      window.open(mailtoLink);
      
      // Mostrar información al usuario
      alert(`✅ Email preparado para envío a: ${email}\n\n📧 Se abrirá tu cliente de email con:\n- Asunto: ${subject}\n- Contraseña: ${password}\n\n📎 Adjunta el PDF descargado al email.`);
      
      // Descargar automáticamente el PDF
      this.downloadPDF(pdfFile);
      
    } catch (error) {
      console.error('Error en fallback de email:', error);
      throw new Error('Error enviando PDF por email');
    }
  }
}; 