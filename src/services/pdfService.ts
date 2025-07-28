import { getFunctions, httpsCallable } from 'firebase/functions';
import { MedicalRecord } from '../types';

export const pdfService = {
  generatePassword(dni: string): string {
    const lastThreeDigits = dni.slice(-3);
    const letter = dni.slice(-1);
    return lastThreeDigits + letter;
  },

  async generateProtectedPDF(record: MedicalRecord): Promise<{ file: File; password: string }> {
    try {
      const functions = getFunctions();
      // Configurar la región para las funciones
      functions.region = 'europe-west1';
      const generateProtectedPDF = httpsCallable(functions, 'generateProtectedPDF');

      const result = await generateProtectedPDF({
        patientName: record.patientName,
        patientSurname: record.patientSurname,
        patientDni: record.patientDni,
        report: record.report
      });

      const { pdfBytes, password, filename } = result.data as any;

      const byteCharacters = atob(pdfBytes);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      return {
        file: new File([blob], filename, { type: 'application/pdf' }),
        password
      };
    } catch (error) {
      console.error('Error generando PDF protegido:', error);
      throw new Error('Error generando PDF protegido');
    }
  },

  generatePDF(record: MedicalRecord): File {
    // This function is kept as a fallback/dummy
    const dummyContent = `Historial de ${record.patientName} ${record.patientSurname}`;
    const blob = new Blob([dummyContent], { type: 'application/pdf' });
    const filename = `historial_${record.patientDni}_${record.createdAt.toISOString().split('T')[0]}.pdf`;

    return new File([blob], filename, { type: 'application/pdf' });
  }
}; 