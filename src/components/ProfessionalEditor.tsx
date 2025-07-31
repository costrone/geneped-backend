import React, { useState, useRef } from 'react';
import { Eye, EyeOff, Download, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, RotateCcw } from 'lucide-react';
import './ProfessionalEditor.css';

interface ProfessionalEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const ProfessionalEditor: React.FC<ProfessionalEditorProps> = ({
  value,
  onChange,
  placeholder = "Escribe el informe clínico aquí...",
  className = ""
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);

  const handleEditorChange = (content: string) => {
    onChange(content);
    setPreviewContent(content);
  };

  const handlePreviewToggle = () => {
    if (!showPreview) {
      const content = editorRef.current?.innerHTML || value;
      setPreviewContent(content);
    }
    setShowPreview(!showPreview);
  };

  const downloadPreview = () => {
    const content = previewContent;
    const blob = new Blob([`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Vista Previa - Informe Clínico</title>
          <style>
            body {
              font-family: 'Times New Roman', serif;
              font-size: 11pt;
              line-height: 1.5;
              margin: 2cm;
              color: #333;
            }
            h1, h2, h3 { color: #2c3e50; }
            p { margin-bottom: 0.5em; text-align: justify; }
            .highlight { background-color: #fff3cd; }
            table { border-collapse: collapse; width: 100%; margin: 1em 0; }
            table, th, td { border: 1px solid #ddd; }
            th, td { padding: 8px; text-align: left; }
            ul, ol { margin: 0.5em 0; padding-left: 2em; }
            blockquote { 
              border-left: 4px solid #3498db; 
              margin: 1em 0; 
              padding-left: 1em; 
              font-style: italic; 
            }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `], { type: 'text/html' });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vista-previa-informe.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      handleEditorChange(editorRef.current.innerHTML);
    }
  };

  const insertList = (type: 'ul' | 'ol') => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const list = document.createElement(type);
      const listItem = document.createElement('li');
      listItem.textContent = '';
      list.appendChild(listItem);
      range.insertNode(list);
      
      // Mover el cursor dentro del primer elemento de la lista
      const newRange = document.createRange();
      newRange.setStart(listItem, 0);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
      
      if (editorRef.current) {
        handleEditorChange(editorRef.current.innerHTML);
      }
    }
  };

  return (
    <div className={`professional-editor ${className}`}>
      <div className="editor-container">
        {!showPreview ? (
          <div className="native-editor-wrapper">
            <div className="editor-toolbar">
              <div className="toolbar-group">
                <button
                  type="button"
                  onClick={() => applyFormat('bold')}
                  className="toolbar-button"
                  title="Negrita (Ctrl+B)"
                >
                  <Bold className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('italic')}
                  className="toolbar-button"
                  title="Cursiva (Ctrl+I)"
                >
                  <Italic className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('underline')}
                  className="toolbar-button"
                  title="Subrayado (Ctrl+U)"
                >
                  <Underline className="h-4 w-4" />
                </button>
              </div>
              
              <div className="toolbar-group">
                <button
                  type="button"
                  onClick={() => applyFormat('justifyLeft')}
                  className="toolbar-button"
                  title="Alinear a la izquierda"
                >
                  <AlignLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('justifyCenter')}
                  className="toolbar-button"
                  title="Centrar"
                >
                  <AlignCenter className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('justifyRight')}
                  className="toolbar-button"
                  title="Alinear a la derecha"
                >
                  <AlignRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('justifyFull')}
                  className="toolbar-button"
                  title="Justificar"
                >
                  <AlignJustify className="h-4 w-4" />
                </button>
              </div>
              
              <div className="toolbar-group">
                <button
                  type="button"
                  onClick={() => insertList('ul')}
                  className="toolbar-button"
                  title="Lista con viñetas"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertList('ol')}
                  className="toolbar-button"
                  title="Lista numerada"
                >
                  <ListOrdered className="h-4 w-4" />
                </button>
              </div>
              
              <div className="toolbar-group">
                <button
                  type="button"
                  onClick={() => applyFormat('removeFormat')}
                  className="toolbar-button"
                  title="Limpiar formato"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
              
              <div className="toolbar-group">
                <button
                  type="button"
                  onClick={handlePreviewToggle}
                  className="preview-button"
                  title="Mostrar vista previa"
                >
                  <Eye className="h-4 w-4" />
                  Vista Previa
                </button>
              </div>
            </div>
            
            <div
              ref={editorRef}
              className="editor-content"
              contentEditable={true}
              dangerouslySetInnerHTML={{ __html: value }}
              onInput={(e) => handleEditorChange(e.currentTarget.innerHTML)}
              onBlur={(e) => handleEditorChange(e.currentTarget.innerHTML)}
              data-placeholder={placeholder}
            />
          </div>
        ) : (
          <div className="preview-container">
            <div className="preview-header">
              <h3 className="preview-title">Vista Previa - Como aparecerá en el PDF</h3>
              <p className="preview-subtitle">Times New Roman 11pt, espaciado simple, justificado</p>
              <button
                type="button"
                onClick={handlePreviewToggle}
                className="preview-button"
                title="Volver al editor"
              >
                <EyeOff className="h-4 w-4" />
                Volver al Editor
              </button>
              <button
                type="button"
                onClick={downloadPreview}
                className="download-button"
                title="Descargar vista previa"
              >
                <Download className="h-4 w-4" />
                Descargar HTML
              </button>
            </div>
            <div 
              className="preview-content"
              dangerouslySetInnerHTML={{ __html: previewContent }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfessionalEditor; 