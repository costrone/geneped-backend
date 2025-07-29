import emailjs from '@emailjs/browser';
import { MedicalRecord } from '../types';

// Configuración de EmailJS
const EMAILJS_SERVICE_ID = process.env.REACT_APP_EMAILJS_SERVICE_ID || '';
const EMAILJS_TEMPLATE_ID = process.env.REACT_APP_EMAILJS_TEMPLATE_ID || '';
const EMAILJS_PUBLIC_KEY = process.env.REACT_APP_EMAILJS_PUBLIC_KEY || '';

export const emailService = {
  // Inicializar EmailJS
  init() {
    emailjs.init(EMAILJS_PUBLIC_KEY);
  },

  // Enviar email con PDF adjunto usando Base64
  async sendProtectedPDF(
    record: MedicalRecord, 
    recipientEmail: string, 
    userEmail: string,
    pdfFile: File
  ): Promise<void> {
    try {
      // Verificar configuración
      if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
        throw new Error('Configuración de EmailJS incompleta. Verifica las variables de entorno.');
      }

      // Generar contraseña
      const password = this.generatePassword(record.patientDni);

      // Convertir PDF a base64 para adjuntarlo
      const pdfBase64 = await this.fileToBase64(pdfFile);

      // Preparar datos del template con adjunto
      const templateParams = {
        to_email: recipientEmail,
        from_email: userEmail,
        patient_name: `${record.patientName} ${record.patientSurname}`,
        patient_dni: record.patientDni,
        report_date: record.createdAt.toLocaleDateString('es-ES'),
        password: password,
        message: `Estimado/a,

Adjunto encontrará el informe clínico del paciente ${record.patientName} ${record.patientSurname} (DNI: ${record.patientDni}).

El documento está protegido con contraseña por motivos de confidencialidad.

🔐 Contraseña del PDF: ${password}

La contraseña está formada por los últimos 3 dígitos del DNI seguidos de la letra.

Saludos cordiales,
${userEmail}
Geneped - Sistema de Gestión de Historiales`,
        // Adjunto en Base64
        attachment: pdfBase64,
        attachment_name: pdfFile.name,
        attachment_type: 'application/pdf'
      };

      // Enviar email usando EmailJS con adjunto
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_PUBLIC_KEY
      );

      console.log('Email enviado exitosamente con adjunto:', response);
      
    } catch (error) {
      console.error('Error enviando email con EmailJS:', error);
      throw new Error(`Error enviando email: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  },

  // Enviar email con enlace de descarga
  async sendEmailWithDownloadLink(
    record: MedicalRecord, 
    recipientEmail: string, 
    userEmail: string,
    downloadLink: string,
    password: string
  ): Promise<void> {
    try {
      // Verificar configuración
      if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
        throw new Error('Configuración de EmailJS incompleta. Verifica las variables de entorno.');
      }

      // Preparar datos del template
      const templateParams = {
        to_email: recipientEmail,
        from_email: userEmail,
        patient_name: `${record.patientName} ${record.patientSurname}`,
        patient_dni: record.patientDni,
        report_date: record.createdAt.toLocaleDateString('es-ES'),
        password: password,
        download_link: downloadLink,
        report_type: record.reportType,
        logo_url: record.reportType === 'Geneped' ? '/logo.png' : '/Medicaes.png',
        message: `Estimado/a,

Adjunto encontrará el enlace de descarga del informe clínico del paciente ${record.patientName} ${record.patientSurname} (DNI: ${record.patientDni}).

El documento está protegido con contraseña por motivos de confidencialidad.

🔗 ENLACE DE DESCARGA: ${downloadLink}

🔐 Contraseña del PDF: ${password}

La contraseña está formada por los últimos 3 dígitos del DNI seguidos de la letra.

⚠️ IMPORTANTE: Este enlace expira en 48 horas por motivos de seguridad.

Saludos cordiales,
${userEmail}
Geneped - Sistema de Gestión de Historiales`
      };

      // Enviar email usando EmailJS
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_PUBLIC_KEY
      );

      console.log('Email con enlace enviado exitosamente:', response);
      
    } catch (error) {
      console.error('Error enviando email con enlace:', error);
      throw new Error(`Error enviando email: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  },

  // Enviar email simple sin adjunto (fallback final)
  async sendSimpleEmail(
    record: MedicalRecord, 
    recipientEmail: string, 
    userEmail: string
  ): Promise<void> {
    try {
      // Verificar configuración
      if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
        throw new Error('Configuración de EmailJS incompleta. Verifica las variables de entorno.');
      }

      // Generar contraseña
      const password = this.generatePassword(record.patientDni);

      // Preparar datos del template
      const templateParams = {
        to_email: recipientEmail,
        from_email: userEmail,
        patient_name: `${record.patientName} ${record.patientSurname}`,
        patient_dni: record.patientDni,
        report_date: record.createdAt.toLocaleDateString('es-ES'),
        password: password,
        message: `Estimado/a,

Adjunto encontrará el informe clínico del paciente ${record.patientName} ${record.patientSurname} (DNI: ${record.patientDni}).

El documento está protegido con contraseña por motivos de confidencialidad.

🔐 Contraseña del PDF: ${password}

La contraseña está formada por los últimos 3 dígitos del DNI seguidos de la letra.

IMPORTANTE: El PDF se ha descargado automáticamente en tu dispositivo. Por favor, adjúntalo manualmente a este email antes de enviarlo.

Saludos cordiales,
${userEmail}
Geneped - Sistema de Gestión de Historiales`
      };

      // Enviar email usando EmailJS
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_PUBLIC_KEY
      );

      console.log('Email enviado exitosamente:', response);
      
    } catch (error) {
      console.error('Error enviando email con EmailJS:', error);
      throw new Error(`Error enviando email: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  },

  // Generar contraseña basada en DNI
  generatePassword(dni: string): string {
    const lastThreeDigits = dni.slice(-3);
    const letter = dni.slice(-1);
    return lastThreeDigits + letter;
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
  },

  // Verificar si EmailJS está configurado
  isConfigured(): boolean {
    return !!(EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY);
  }
}; 