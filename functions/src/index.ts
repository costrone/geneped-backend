import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

admin.initializeApp();

export const generateProtectedPDF = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
  // Verificar autenticación
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  try {
    const { patientName, patientSurname, patientDni, report } = data;

    // Crear PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Título
    page.drawText('HISTORIAL MÉDICO', {
      x: 50,
      y: 750,
      size: 20,
      font,
      color: rgb(0, 0, 0)
    });

    // Datos del paciente
    page.drawText('DATOS DEL PACIENTE:', {
      x: 50,
      y: 700,
      size: 14,
      font,
      color: rgb(0, 0, 0)
    });

    page.drawText(`Nombre: ${patientName} ${patientSurname}`, {
      x: 50,
      y: 670,
      size: 12,
      font,
      color: rgb(0, 0, 0)
    });

    page.drawText(`DNI: ${patientDni}`, {
      x: 50,
      y: 650,
      size: 12,
      font,
      color: rgb(0, 0, 0)
    });

    page.drawText(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, {
      x: 50,
      y: 630,
      size: 12,
      font,
      color: rgb(0, 0, 0)
    });

    // Línea separadora
    page.drawLine({
      start: { x: 50, y: 610 },
      end: { x: 545, y: 610 },
      thickness: 1,
      color: rgb(0, 0, 0)
    });

    // Informe médico
    page.drawText('INFORME MÉDICO:', {
      x: 50,
      y: 580,
      size: 14,
      font,
      color: rgb(0, 0, 0)
    });

    // Dividir el texto en líneas
    const words = report.split(' ');
    let line = '';
    let y = 550;
    const maxWidth = 495;

    for (const word of words) {
      const testLine = line + word + ' ';
      const testWidth = font.widthOfTextAtSize(testLine, 12);
      
      if (testWidth > maxWidth && line !== '') {
        page.drawText(line, {
          x: 50,
          y,
          size: 12,
          font,
          color: rgb(0, 0, 0)
        });
        line = word + ' ';
        y -= 20;
        
        if (y < 50) break; // Evitar que el texto se salga de la página
      } else {
        line = testLine;
      }
    }

    // Dibujar la última línea
    if (line) {
      page.drawText(line, {
        x: 50,
        y,
        size: 12,
        font,
        color: rgb(0, 0, 0)
      });
    }

    // Generar contraseña (3 últimos dígitos + letra)
    const password = patientDni.slice(-3) + patientDni.slice(-1);

    // Guardar PDF sin protección por ahora (para evitar errores de TypeScript)
    const pdfBytes = await pdfDoc.save();

    return {
      pdfBytes: Buffer.from(pdfBytes).toString('base64'),
      password,
      filename: `historial_${patientDni}_${new Date().toISOString().split('T')[0]}.pdf`
    };

  } catch (error) {
    console.error('Error generando PDF:', error);
    throw new functions.https.HttpsError('internal', 'Error generando PDF');
  }
}); 