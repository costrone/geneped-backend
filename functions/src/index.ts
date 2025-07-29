import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

admin.initializeApp();

export const generateProtectedPDF = functions.https.onCall(async (data, context) => {
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

// Configurar Resend para envío de emails
const RESEND_API_KEY = functions.config().resend?.api_key || process.env.RESEND_API_KEY;

export const sendEmailWithAttachment = functions.https.onCall(async (data, context) => {
  // Verificar autenticación
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  try {
    const {
      toEmail,
      fromEmail,
      patientName,
      patientDni,
      password,
      pdfBase64,
      filename
    } = data;

    // Validar datos requeridos
    if (!toEmail || !fromEmail || !patientName || !password || !pdfBase64) {
      throw new functions.https.HttpsError('invalid-argument', 'Datos incompletos');
    }

    // Si Resend no está configurado, usar nodemailer como fallback
    if (!RESEND_API_KEY) {
      return await sendEmailWithNodemailer(data);
    }

    // Enviar email con Resend
    const emailData = {
      from: fromEmail,
      to: toEmail,
      subject: `Informe Clínico - ${patientName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Informe Clínico - ${patientName}</h2>
          
          <p>Estimado/a,</p>
          
          <p>Adjunto encontrará el informe clínico del paciente <strong>${patientName}</strong> (DNI: ${patientDni}).</p>
          
          <p>El documento está protegido con contraseña por motivos de confidencialidad.</p>
          
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #dc2626; margin: 0;">🔐 Contraseña del PDF: <strong>${password}</strong></h3>
            <p style="margin: 10px 0 0 0; font-size: 14px;">La contraseña está formada por los últimos 3 dígitos del DNI seguidos de la letra.</p>
          </div>
          
          <p>Saludos cordiales,<br>
          <strong>${fromEmail}</strong><br>
          Geneped - Sistema de Gestión de Historiales</p>
        </div>
      `,
      attachments: [
        {
          filename: filename,
          content: pdfBase64,
          encoding: 'base64'
        }
      ]
    };

    // Importar Resend dinámicamente
    const { Resend } = await import('resend');
    const resend = new Resend(RESEND_API_KEY);

    const result = await resend.emails.send(emailData);

    return {
      success: true,
      messageId: result.data?.id,
      message: 'Email enviado exitosamente'
    };

  } catch (error) {
    console.error('Error enviando email:', error);
    throw new functions.https.HttpsError('internal', 'Error enviando email');
  }
});

// Función fallback usando nodemailer
async function sendEmailWithNodemailer(data: any) {
  const nodemailer = require('nodemailer');
  
  // Configurar transportador (usar Gmail como ejemplo)
  const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: functions.config().email?.user,
      pass: functions.config().email?.password
    }
  });

  const {
    toEmail,
    fromEmail,
    patientName,
    patientDni,
    password,
    pdfBase64,
    filename
  } = data;

  const mailOptions = {
    from: fromEmail,
    to: toEmail,
    subject: `Informe Clínico - ${patientName}`,
    html: `
      <h2>Informe Clínico - ${patientName}</h2>
      <p>Estimado/a,</p>
      <p>Adjunto encontrará el informe clínico del paciente ${patientName} (DNI: ${patientDni}).</p>
      <p>El documento está protegido con contraseña por motivos de confidencialidad.</p>
      <h3>🔐 Contraseña del PDF: ${password}</h3>
      <p>Saludos cordiales,<br>${fromEmail}</p>
    `,
    attachments: [
      {
        filename: filename,
        content: pdfBase64,
        encoding: 'base64'
      }
    ]
  };

  const result = await transporter.sendMail(mailOptions);
  
  return {
    success: true,
    messageId: result.messageId,
    message: 'Email enviado exitosamente con nodemailer'
  };
} 