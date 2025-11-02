import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import { 
  Bold, 
  Italic, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify,
  List,
  ListOrdered,
  Table as TableIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  Unlink,
  Eye,
  EyeOff,
  Download,
  Palette,
  Highlighter
} from 'lucide-react';
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
  placeholder = 'Escribe el informe clínico aquí...',
  className = ''
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);

  const editor = useEditor({
    extensions: (() => {
      const baseExtensions = [
        StarterKit.configure({
          heading: false,
          codeBlock: false,
          blockquote: false,
          horizontalRule: false,
        }),
        TextAlign.configure({
          types: ['heading', 'paragraph'],
          alignments: ['left', 'center', 'right', 'justify'],
        }),
        Table,
        TableRow,
        TableHeader,
        TableCell,
        Image.configure({
          allowBase64: true,
          inline: true,
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'text-blue-600 underline',
          },
        }),
        Underline,
        TextStyle,
        Color,
        Highlight.configure({
          multicolor: true,
        }),
      ];

      // Deduplicar por nombre de extensión para evitar el warning de TipTap
      const uniqueByName: any[] = [];
      const seen = new Set<string>();
      for (const ext of baseExtensions) {
        const name = (ext as any)?.name;
        if (!name || !seen.has(name)) {
          if (name) seen.add(name);
          uniqueByName.push(ext);
        }
      }
      return uniqueByName;
    })(),
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
        'data-placeholder': placeholder,
      },
    },
    editable: true,
  });

  // Actualizar el contenido del editor cuando cambie el valor
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '');
    }
  }, [editor, value]);

  const addLink = () => {
    if (linkUrl) {
      editor?.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
      setLinkUrl('');
      setShowLinkInput(false);
    }
  };

  const addImage = () => {
    if (imageUrl) {
      editor?.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl('');
      setShowImageInput(false);
    }
  };

  const addTable = () => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const setTextColor = (color: string) => {
    editor?.chain().focus().setColor(color).run();
    setShowColorPicker(false);
  };

  const setHighlightColor = (color: string) => {
    editor?.chain().focus().toggleHighlight({ color }).run();
    setShowHighlightPicker(false);
  };

  const downloadHTML = () => {
    if (editor) {
      const html = editor.getHTML();
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'informe-clinico.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  if (!editor) {
    return <div className="loading">Cargando editor...</div>;
  }

  return (
    <div className={`professional-editor ${className}`}>
      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-section">
          {/* Text Formatting */}
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`toolbar-button ${editor.isActive('bold') ? 'active' : ''}`}
            title="Negrita"
          >
            <Bold size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`toolbar-button ${editor.isActive('italic') ? 'active' : ''}`}
            title="Cursiva"
          >
            <Italic size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`toolbar-button ${editor.isActive('underline') ? 'active' : ''}`}
            title="Subrayado"
          >
            <UnderlineIcon size={16} />
          </button>
        </div>

        <div className="toolbar-section">
          {/* Text Alignment */}
          <button
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={`toolbar-button ${editor.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
            title="Alinear izquierda"
          >
            <AlignLeft size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={`toolbar-button ${editor.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
            title="Centrar"
          >
            <AlignCenter size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={`toolbar-button ${editor.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
            title="Alinear derecha"
          >
            <AlignRight size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            className={`toolbar-button ${editor.isActive({ textAlign: 'justify' }) ? 'active' : ''}`}
            title="Justificar"
          >
            <AlignJustify size={16} />
          </button>
        </div>

        <div className="toolbar-section">
          {/* Lists */}
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`toolbar-button ${editor.isActive('bulletList') ? 'active' : ''}`}
            title="Lista con viñetas"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`toolbar-button ${editor.isActive('orderedList') ? 'active' : ''}`}
            title="Lista numerada"
          >
            <ListOrdered size={16} />
          </button>
        </div>

        <div className="toolbar-section">
          {/* Advanced Features */}
          <button
            onClick={addTable}
            className="toolbar-button"
            title="Insertar tabla"
          >
            <TableIcon size={16} />
          </button>
          <button
            onClick={() => setShowImageInput(true)}
            className="toolbar-button"
            title="Insertar imagen"
          >
            <ImageIcon size={16} />
          </button>
          <button
            onClick={() => setShowLinkInput(true)}
            className={`toolbar-button ${editor.isActive('link') ? 'active' : ''}`}
            title="Insertar enlace"
          >
            <LinkIcon size={16} />
          </button>
          {editor.isActive('link') && (
            <button
              onClick={() => editor.chain().focus().unsetLink().run()}
              className="toolbar-button"
              title="Quitar enlace"
            >
              <Unlink size={16} />
            </button>
          )}
        </div>

        <div className="toolbar-section">
          {/* Colors */}
          <div className="color-picker-container">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="toolbar-button"
              title="Color de texto"
            >
              <Palette size={16} />
            </button>
            {showColorPicker && (
              <div className="color-picker">
                {['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#008000'].map((color) => (
                  <button
                    key={color}
                    onClick={() => setTextColor(color)}
                    className="color-option"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="color-picker-container">
            <button
              onClick={() => setShowHighlightPicker(!showHighlightPicker)}
              className="toolbar-button"
              title="Resaltar texto"
            >
              <Highlighter size={16} />
            </button>
            {showHighlightPicker && (
              <div className="color-picker">
                {['#FFEB3B', '#FF9800', '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4'].map((color) => (
                  <button
                    key={color}
                    onClick={() => setHighlightColor(color)}
                    className="color-option"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="toolbar-section">
          {/* Preview and Download */}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="toolbar-button"
            title={showPreview ? 'Ocultar vista previa' : 'Mostrar vista previa'}
          >
            {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button
            onClick={downloadHTML}
            className="toolbar-button"
            title="Descargar HTML"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* Link Input Modal */}
      {showLinkInput && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Insertar enlace</h3>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://ejemplo.com"
              className="modal-input"
            />
            <div className="modal-buttons">
              <button onClick={addLink} className="btn-primary">Insertar</button>
              <button onClick={() => setShowLinkInput(false)} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Image Input Modal */}
      {showImageInput && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Insertar imagen</h3>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://ejemplo.com/imagen.jpg"
              className="modal-input"
            />
            <div className="modal-buttons">
              <button onClick={addImage} className="btn-primary">Insertar</button>
              <button onClick={() => setShowImageInput(false)} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Content */}
      <div className="editor-content">
        <EditorContent 
          editor={editor} 
          className="tiptap-editor"
          data-placeholder={placeholder}
        />
      </div>

      {/* Preview */}
      {showPreview && (
        <div className="preview-container">
          <h3>Vista previa del PDF</h3>
          <div 
            className="preview-content"
            dangerouslySetInnerHTML={{ __html: editor.getHTML() }}
          />
        </div>
      )}
    </div>
  );
};

export default ProfessionalEditor; 