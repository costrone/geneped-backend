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
    const ratio = Math.min(
      maxWidth / originalWidth,
      maxHeight / originalHeight
    );
    return {
      width: originalWidth * ratio,
      height: originalHeight * ratio,
    };
  }

  // Generar PDF sin contraseña (para uso interno)
  async generatePDF(record: MedicalRecord): Promise<File> {
    const doc = new jsPDF();
    
    // Configuración de márgenes
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    // Calcular ancho de contenido más conservador para evitar desbordes
    // Usar unidades en mm y asegurar margen adecuado
    const contentWidth = pageWidth - margin * 2 - 10;
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
      const logoBase64 = btoa(
        String.fromCharCode(...Array.from(new Uint8Array(logoArrayBuffer)))
      );
      
      // Crear una imagen temporal para obtener las dimensiones originales
      const img = new Image();
      img.src = `data:image/png;base64,${logoBase64}`;
      
      await new Promise(resolve => {
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
          
          doc.addImage(
            `data:image/png;base64,${logoBase64}`,
            'PNG',
            logoX,
            yPosition,
            width,
            height
          );
          resolve(null);
        };
      });
    } catch (error) {
      console.warn('No se pudo cargar el logo:', error);
    }

    // Título del informe
    yPosition += 45;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold'); // Helvetica es muy similar a Arial
    doc.text('INFORME CLÍNICO', pageWidth / 2, yPosition, { align: 'center' });

    // Información del paciente
    yPosition += 20;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL PACIENTE:', margin, yPosition);
    
    yPosition += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Nombre: ${record.patientName} ${record.patientSurname}`,
      margin,
      yPosition
    );
    
    yPosition += 8;
    doc.text(`DNI: ${record.patientDni}`, margin, yPosition);
    
    yPosition += 8;
    doc.text(
      `Fecha de nacimiento: ${record.patientBirthDate}`,
      margin,
      yPosition
    );

    // Informe clínico
    yPosition += 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    
    // Título con número de historia a la derecha
    const titleText = 'INFORME CLÍNICO:';
    const recordNumberText = record.recordNumber
      ? `#${record.recordNumber}`
      : '';
    
    if (recordNumberText) {
      // Calcular posición del número de historia (alineado a la derecha)
      const numberWidth = doc.getTextWidth(recordNumberText);
      const numberX = pageWidth - margin - numberWidth;
      
      // Dibujar título
      doc.text(titleText, margin, yPosition);
      
      // Dibujar número de historia
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(recordNumberText, numberX, yPosition);
      
      // Restaurar tamaño y estilo para el contenido
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
    } else {
      doc.text(titleText, margin, yPosition);
    }
    
    yPosition += 10;
    doc.setFont('helvetica', 'normal'); // Helvetica es visualmente muy similar a Arial
    doc.setFontSize(11);
    
    // Renderizar HTML preservando formato (negrita y párrafos)
    yPosition = this.renderFormattedText(
      doc,
      record.report,
      margin,
      yPosition,
      contentWidth
    );

    // Pruebas solicitadas (solo si existen)
    if (record.requestedTests && record.requestedTests.trim() !== '') {
      yPosition += 10;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('PRUEBAS SOLICITADAS:', margin, yPosition);
      
      yPosition += 10;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const testsLines = doc.splitTextToSize(
        record.requestedTests,
        contentWidth
      );
      
      for (const line of testsLines) {
        if (yPosition > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          yPosition = margin;
        }
        doc.text(line, margin, yPosition, { align: 'left' });
        yPosition += 6;
      }
    }

    // Documentos adjuntos (solo si existen)
    if (record.uploadedDocuments && record.uploadedDocuments.length > 0) {
      yPosition += 10;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('DOCUMENTOS ADJUNTOS:', margin, yPosition);
      
      yPosition += 10;
      doc.setFontSize(11);
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
    const filename = `Informe_${record.patientName}_${
      record.patientSurname
    }_${currentDate.replace(/\//g, '-')}.pdf`;
    
    return new File([pdfBlob], filename, { type: 'application/pdf' });
  }

  // Proteger PDF subido directamente
  async generateProtectedPDFFromFile(
    file: File,
    password: string
  ): Promise<File> {
    try {
      // Leer el archivo PDF
      const arrayBuffer = await file.arrayBuffer();
      
      // Intentar cargar el PDF, ignorando encriptación si ya está protegido
      let pdfDoc: PDFDocument;
      try {
        pdfDoc = await PDFDocument.load(arrayBuffer);
      } catch (loadError: any) {
        // Si el PDF ya está encriptado, intentar cargarlo ignorando la encriptación
        if (loadError.message && loadError.message.includes('encrypted')) {
          try {
            pdfDoc = await PDFDocument.load(arrayBuffer, {
              ignoreEncryption: true,
            });
          } catch (ignoreError) {
            throw new Error(
              'El PDF ya está protegido con contraseña. No se puede aplicar una nueva protección sin la contraseña original.'
            );
          }
        } else {
          throw loadError;
        }
      }
      
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
          documentAssembly: false,
        },
      });

      // Guardar PDF protegido
      const protectedPdfBytes = await pdfDoc.save();

      // Crear archivo protegido
      const protectedBlob = new Blob([protectedPdfBytes], {
        type: 'application/pdf',
      });
      const filename = file.name.replace('.pdf', '_protegido.pdf');
      
      return new File([protectedBlob], filename, { type: 'application/pdf' });
    } catch (error) {
      console.error('Error protegiendo PDF:', error);
      if (error instanceof Error) {
        throw error;
      }
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
      const protectedPDF = await this.generateProtectedPDFFromFile(
        unprotectedPDF,
        password
      );
      
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
      const fileName = `documents/${record.patientId}/pdfs/${
        record.patientDni
      }_${Date.now()}.pdf`;
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

  // Función para renderizar texto con formato (negrita y párrafos) en PDF
  // Preserva EXACTAMENTE el formato del editor
  private renderFormattedText(
    doc: jsPDF,
    htmlText: string,
    margin: number,
    startY: number,
    maxWidth: number
  ): number {
    // Log para depuración
    console.log('renderFormattedText - HTML recibido:', htmlText);
    console.log('renderFormattedText - Tipo:', typeof htmlText);
    console.log(
      'renderFormattedText - Contiene etiquetas HTML:',
      /<[^>]+>/.test(htmlText)
    );

    let yPosition = startY;
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const lineHeight = 6;
    const paragraphSpacing = 8;
    
    // Crear elemento temporal para procesar HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlText;
    
    // Si el HTML no tiene estructura (solo texto), envolver en párrafo
    // Esto puede pasar si el editor genera texto plano
    if (
      tempDiv.childNodes.length === 0 ||
      (tempDiv.childNodes.length === 1 &&
        tempDiv.childNodes[0].nodeType === Node.TEXT_NODE)
    ) {
      // No hay estructura HTML, tratar como texto plano
      console.log(
        'renderFormattedText - Detectado texto plano sin estructura HTML'
      );
      const plainText = htmlText.trim();
      if (plainText) {
        const lines = doc.splitTextToSize(plainText, maxWidth);
        for (const line of lines) {
          if (yPosition > pageHeight - margin - 20) {
            doc.addPage();
            yPosition = margin;
          }
          doc.text(line, margin, yPosition, { align: 'left' });
          yPosition += lineHeight;
        }
      }
      return yPosition;
    }

    // Tipo para tokens de texto con formato
    interface TextToken {
      text: string;
      isBold: boolean;
      isItalic: boolean;
      isLineBreak: boolean;
    }

    // Función para extraer tokens de texto preservando estructura exacta
    const extractTokens = (
      node: Node,
      isBold: boolean = false,
      isItalic: boolean = false
    ): TextToken[] => {
      const tokens: TextToken[] = [];
      
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        // Preservar el texto exactamente, incluyendo espacios
        if (text.length > 0) {
          tokens.push({ text, isBold, isItalic, isLineBreak: false });
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const tagName = element.tagName.toLowerCase();
        
        // Detectar negrita y cursiva
        const childIsBold = isBold || tagName === 'strong' || tagName === 'b';
        const childIsItalic = isItalic || tagName === 'em' || tagName === 'i';

        // Si es un salto de línea
        if (tagName === 'br') {
          tokens.push({
            text: '',
            isBold: false,
            isItalic: false,
            isLineBreak: true,
          });
        } else {
          // Procesar hijos recursivamente
          for (const child of Array.from(element.childNodes)) {
            tokens.push(...extractTokens(child, childIsBold, childIsItalic));
          }
        }
      }

      return tokens;
    };

    // Función para renderizar un párrafo completo con formato inline exacto
    const renderParagraph = (element: Element): void => {
      const tokens = extractTokens(element, false, false);

      if (tokens.length === 0) return;

      // Normalizar tokens: combinar tokens adyacentes del mismo formato
      const normalized: TextToken[] = [];
      for (const token of tokens) {
        if (token.isLineBreak) {
          normalized.push(token);
        } else if (token.text.trim() || token.text.length > 0) {
          if (
            normalized.length > 0 &&
            !normalized[normalized.length - 1].isLineBreak &&
            normalized[normalized.length - 1].isBold === token.isBold &&
            normalized[normalized.length - 1].isItalic === token.isItalic
          ) {
            // Mismo formato - combinar (preservar espacios)
            normalized[normalized.length - 1].text += token.text;
          } else {
            // Nuevo formato
            normalized.push({ ...token });
          }
        }
      }

      // Renderizar tokens preservando formato inline en la misma línea
      let currentX = margin;
      
      for (let i = 0; i < normalized.length; i++) {
        const token = normalized[i];
        
        // Verificar nueva página
        if (yPosition > pageHeight - margin - 20) {
          doc.addPage();
          yPosition = margin;
          currentX = margin;
        }
        
        if (token.isLineBreak) {
          // Salto de línea explícito
          yPosition += lineHeight;
          currentX = margin;
          continue;
        }

        if (!token.text.trim() && token.text.length === 0) continue;

        // Establecer fuente según formato (negrita y/o cursiva)
        let fontStyle = 'normal';
        if (token.isBold && token.isItalic) {
          fontStyle = 'bolditalic';
        } else if (token.isBold) {
          fontStyle = 'bold';
        } else if (token.isItalic) {
          fontStyle = 'italic';
        }
        doc.setFont('helvetica', fontStyle);

        // Si estamos al inicio de línea
        if (currentX === margin) {
          // Dividir el texto en líneas que caben
          const lines = doc.splitTextToSize(token.text, maxWidth);
          
          for (let j = 0; j < lines.length; j++) {
            if (yPosition > pageHeight - margin - 20) {
              doc.addPage();
              yPosition = margin;
            }
            
            doc.text(lines[j], margin, yPosition, { align: 'left' });
            
            if (j < lines.length - 1) {
              // No es la última línea - avanzar Y
              yPosition += lineHeight;
            } else {
              // Es la última línea - calcular posición X para siguiente token
              currentX = margin + doc.getTextWidth(lines[j]);
            }
          }
        } else {
          // Hay contenido previo en la línea - continuar con formato inline
          // IMPORTANTE: Siempre intentar continuar en la misma línea cuando cambia el formato
          const availableWidth = pageWidth - currentX - margin;

          // Preparar el texto a añadir
          const trimmedToken = token.text.trim();
          if (!trimmedToken) continue; // Saltar tokens vacíos
          
          // Dividir en palabras para verificar palabra por palabra
          const words = trimmedToken.split(/\s+/).filter(w => w.length > 0);
          
          if (words.length === 0) continue;
          
          // Verificar palabra por palabra si caben en la línea actual
          let textThatFits = '';
          let remainingWords: string[] = [];
          
          for (let w = 0; w < words.length; w++) {
            const word = words[w];
            
            // Construir el texto hasta esta palabra (incluyendo espacio antes si es necesario)
            const spaceBefore = (currentX > margin && textThatFits === '') ? ' ' : '';
            const spaceBetween = textThatFits ? ' ' : '';
            const testText = spaceBefore + textThatFits + spaceBetween + word;
            const testWidth = doc.getTextWidth(testText);
            
            // Verificar si esta palabra cabe
            if (testWidth <= availableWidth) {
              // Esta palabra cabe - añadirla al texto que cabe
              textThatFits = textThatFits ? textThatFits + ' ' + word : word;
            } else {
              // Esta palabra no cabe - guardar el resto y salir
              remainingWords = words.slice(w);
              break;
            }
          }
          
          if (textThatFits) {
            // Renderizar la parte que cabe en la línea actual
            // Añadir espacio antes solo si hay contenido previo en la línea
            const prefix = currentX > margin ? ' ' : '';
            doc.text(prefix + textThatFits, currentX, yPosition, { align: 'left' });
            currentX += doc.getTextWidth(prefix + textThatFits);
            
            // Si hay palabras restantes, renderizarlas en nueva línea
            if (remainingWords.length > 0) {
              yPosition += lineHeight;
              currentX = margin;
              
              if (yPosition > pageHeight - margin - 20) {
                doc.addPage();
                yPosition = margin;
              }
              
              // Renderizar el resto en nueva línea
              const remainingText = remainingWords.join(' ');
              const lines = doc.splitTextToSize(remainingText, maxWidth);
              for (let j = 0; j < lines.length; j++) {
                if (yPosition > pageHeight - margin - 20) {
                  doc.addPage();
                  yPosition = margin;
                }
                doc.text(lines[j], margin, yPosition, { align: 'left' });
                if (j < lines.length - 1) {
                  yPosition += lineHeight;
                } else {
                  currentX = margin + doc.getTextWidth(lines[j]);
                }
              }
            }
          } else {
            // Ni siquiera la primera palabra cabe - nueva línea completa
            yPosition += lineHeight;
            currentX = margin;
            
            if (yPosition > pageHeight - margin - 20) {
              doc.addPage();
              yPosition = margin;
            }
            
            const lines = doc.splitTextToSize(trimmedToken, maxWidth);
            for (let j = 0; j < lines.length; j++) {
              if (yPosition > pageHeight - margin - 20) {
                doc.addPage();
                yPosition = margin;
              }
              doc.text(lines[j], margin, yPosition, { align: 'left' });
              if (j < lines.length - 1) {
                yPosition += lineHeight;
              } else {
                currentX = margin + doc.getTextWidth(lines[j]);
              }
            }
          }
        }
      }
      
      // Avanzar Y después del párrafo
      yPosition += lineHeight;
    };
    
    // Procesar todos los nodos de nivel superior
    const topLevelNodes = Array.from(tempDiv.childNodes);
    let isFirstBlock = true;
    
    for (const node of topLevelNodes) {
      if (yPosition > pageHeight - margin - 20) {
        doc.addPage();
        yPosition = margin;
      }

        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          const tagName = element.tagName.toLowerCase();
          
        // Si es un elemento bloque
        if (
          ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)
        ) {
          // Verificar si el párrafo está vacío
          const textContent = element.textContent?.trim();
          if (!textContent) {
            // Párrafo vacío - solo añadir espacio pequeño
            if (!isFirstBlock) {
              yPosition += lineHeight;
            }
            isFirstBlock = false;
            continue;
          }

          // Añadir espacio entre bloques (excepto el primero)
          if (!isFirstBlock) {
            yPosition += paragraphSpacing;
          }
          isFirstBlock = false;

          // Renderizar el párrafo completo
          renderParagraph(element);
        } else if (['ul', 'ol'].includes(tagName)) {
          // Lista - procesar cada elemento de lista
          if (!isFirstBlock) {
            yPosition += paragraphSpacing;
          }
          isFirstBlock = false;

          const listItems = element.querySelectorAll('li');
          listItems.forEach((li, index) => {
            if (yPosition > pageHeight - margin - 20) {
              doc.addPage();
              yPosition = margin;
            }

            // Añadir viñeta o número
            const listMarker = tagName === 'ol' ? `${index + 1}. ` : '• ';
            doc.setFont('helvetica', 'normal');
            doc.text(listMarker, margin, yPosition, { align: 'left' });

            // Calcular ancho del marcador para alinear el texto
            const markerWidth = doc.getTextWidth(listMarker);
            const indentMargin = margin + markerWidth;
            const indentWidth = maxWidth - markerWidth;

            // Renderizar contenido del elemento de lista con indentación
            const tokens = extractTokens(li, false, false);
            if (tokens.length > 0) {
              const normalized: TextToken[] = [];
              for (const token of tokens) {
                if (token.isLineBreak) {
                  normalized.push(token);
                } else if (token.text.trim() || token.text.length > 0) {
                  if (
                    normalized.length > 0 &&
                    !normalized[normalized.length - 1].isLineBreak &&
                    normalized[normalized.length - 1].isBold === token.isBold &&
                    normalized[normalized.length - 1].isItalic ===
                      token.isItalic
                  ) {
                    normalized[normalized.length - 1].text += token.text;
                  } else {
                    normalized.push({ ...token });
                  }
                }
              }

              let currentX = indentMargin;
              for (const token of normalized) {
                if (yPosition > pageHeight - margin - 20) {
                  doc.addPage();
                  yPosition = margin;
                  currentX = indentMargin;
                }

                if (token.isLineBreak) {
                  yPosition += lineHeight;
                  currentX = indentMargin;
                  continue;
                }

                if (!token.text.trim() && token.text.length === 0) continue;

                let fontStyle = 'normal';
                if (token.isBold && token.isItalic) {
                  fontStyle = 'bolditalic';
                } else if (token.isBold) {
                  fontStyle = 'bold';
                } else if (token.isItalic) {
                  fontStyle = 'italic';
                }
                doc.setFont('helvetica', fontStyle);

                if (currentX === indentMargin) {
                  const lines = doc.splitTextToSize(token.text, indentWidth);
                  for (let j = 0; j < lines.length; j++) {
                    if (yPosition > pageHeight - margin - 20) {
                      doc.addPage();
                      yPosition = margin;
                    }
                    doc.text(lines[j], indentMargin, yPosition, {
                      align: 'left',
                    });
                    if (j < lines.length - 1) {
                      yPosition += lineHeight;
                    } else {
                      currentX = indentMargin + doc.getTextWidth(lines[j]);
                    }
                  }
                } else {
                  // Hay contenido previo en la línea - continuar con formato inline
                  const availableWidth = pageWidth - currentX - margin;
                  const trimmedToken = token.text.trim();
                  
                  if (!trimmedToken) continue;
                  
                  // Dividir en palabras para verificar palabra por palabra
                  const words = trimmedToken.split(/\s+/).filter(w => w.length > 0);
                  
                  if (words.length === 0) continue;
                  
                  // Verificar palabra por palabra si caben en la línea actual
                  let textThatFits = '';
                  let remainingWords: string[] = [];
                  
                  for (let w = 0; w < words.length; w++) {
                    const word = words[w];
                    
                    // Construir el texto hasta esta palabra (incluyendo espacio antes si es necesario)
                    const spaceBefore = (currentX > indentMargin && textThatFits === '') ? ' ' : '';
                    const spaceBetween = textThatFits ? ' ' : '';
                    const testText = spaceBefore + textThatFits + spaceBetween + word;
                    const testWidth = doc.getTextWidth(testText);
                    
                    // Verificar si esta palabra cabe
                    if (testWidth <= availableWidth) {
                      // Esta palabra cabe - añadirla al texto que cabe
                      textThatFits = textThatFits ? textThatFits + ' ' + word : word;
                    } else {
                      // Esta palabra no cabe - guardar el resto y salir
                      remainingWords = words.slice(w);
                      break;
                    }
                  }
                  
                  if (textThatFits) {
                    // Renderizar la parte que cabe en la línea actual
                    const prefix = currentX > indentMargin ? ' ' : '';
                    doc.text(prefix + textThatFits, currentX, yPosition, {
                      align: 'left',
                    });
                    currentX += doc.getTextWidth(prefix + textThatFits);
                    
                    // Si hay palabras restantes, renderizarlas en nueva línea
                    if (remainingWords.length > 0) {
                      yPosition += lineHeight;
                      currentX = indentMargin;
                      
                      if (yPosition > pageHeight - margin - 20) {
                        doc.addPage();
                        yPosition = margin;
                      }
                      
                      // Renderizar el resto en nueva línea
                      const remainingText = remainingWords.join(' ');
                      const lines = doc.splitTextToSize(remainingText, indentWidth);
                      for (let j = 0; j < lines.length; j++) {
                        if (yPosition > pageHeight - margin - 20) {
                          doc.addPage();
                          yPosition = margin;
                        }
                        doc.text(lines[j], indentMargin, yPosition, {
                          align: 'left',
                        });
                        if (j < lines.length - 1) {
                          yPosition += lineHeight;
                        } else {
                          currentX = indentMargin + doc.getTextWidth(lines[j]);
                        }
                      }
                    }
                  } else {
                    // Ni siquiera la primera palabra cabe - nueva línea completa
                    yPosition += lineHeight;
                    currentX = indentMargin;
                    
                    if (yPosition > pageHeight - margin - 20) {
                      doc.addPage();
                      yPosition = margin;
                    }
                    
                    const lines = doc.splitTextToSize(trimmedToken, indentWidth);
                    for (let j = 0; j < lines.length; j++) {
                      if (yPosition > pageHeight - margin - 20) {
                        doc.addPage();
                        yPosition = margin;
                      }
                      doc.text(lines[j], indentMargin, yPosition, {
                        align: 'left',
                      });
                      if (j < lines.length - 1) {
                        yPosition += lineHeight;
                      } else {
                        currentX = indentMargin + doc.getTextWidth(lines[j]);
                      }
                    }
                  }
                }
              }

              if (currentX > indentMargin) {
                yPosition += lineHeight;
              }
            }

            yPosition += lineHeight / 2; // Espacio pequeño entre elementos de lista
          });
        } else if (tagName === 'li') {
          // Elemento de lista individual (ya procesado dentro de ul/ol)
          // No hacer nada aquí, se maneja arriba
          } else {
          // Elemento inline de nivel superior - tratarlo como párrafo
          if (!isFirstBlock) {
            yPosition += paragraphSpacing;
          }
          isFirstBlock = false;
          renderParagraph(element);
          }
        } else if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent?.trim();
          if (text) {
            if (!isFirstBlock) {
            yPosition += paragraphSpacing;
          }
          isFirstBlock = false;

          doc.setFont('helvetica', 'normal');
          const lines = doc.splitTextToSize(text, maxWidth);

          for (const line of lines) {
            if (yPosition > pageHeight - margin - 20) {
              doc.addPage();
              yPosition = margin;
            }
            doc.text(line, margin, yPosition, { align: 'left' });
            yPosition += lineHeight;
          }
        }
      }
    }
    
    return yPosition;
  }

  // Función para convertir HTML a texto plano (para uso en otras secciones)
  private convertHtmlToPlainText(html: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Procesar elementos específicos
    const paragraphs = tempDiv.querySelectorAll('p');
    paragraphs.forEach(p => {
      // Asegurar que los párrafos NO estén justificados (alineados a la izquierda)
      p.style.textAlign = 'left';
      p.style.marginBottom = '0.5em';
    });
    
    // Convertir a texto manteniendo estructura
    let plainText = tempDiv.textContent || tempDiv.innerText || '';
    
    // Eliminar caracteres no estándar/corruptos (mantener solo caracteres alfanuméricos, puntuación y espacios normales)
    plainText = plainText
      .replace(
        /[^\x20-\x7E\u00A1-\u00FF\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF\u00C0-\u017F\n\r\t]/g,
        ' '
      ) // Eliminar caracteres no imprimibles y corruptos
      .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g, ' ') // Espacios no separables y otros tipos de espacio
      .replace(/[ \t]+/g, ' ') // Múltiples espacios/tabs a uno solo
      .replace(/\.([A-ZÁÉÍÓÚÑÇ])/g, '. $1') // Añadir espacio después de punto seguido de mayúscula
      .replace(/\n\s*\n\s*\n+/g, '\n\n') // Múltiples saltos de línea a máximo 2
      .replace(/\n /g, '\n') // Espacios al inicio de línea
      .replace(/ \n/g, '\n') // Espacios al final de línea
      .replace(/[^\S\n]+/g, ' ') // Cualquier otro espacio en blanco a espacio normal
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
