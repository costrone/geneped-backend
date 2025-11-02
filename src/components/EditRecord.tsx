import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Download, AlertCircle, CheckCircle, User, Shield, ArrowLeft, Save, Upload, X, File, TestTube, ExternalLink } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { patientService, medicalRecordService, storageService } from '../services/firebase';
import { pdfService } from '../services/pdfService';
import { MedicalRecord, Patient } from '../types';
import ProfessionalEditor from './ProfessionalEditor';

const schema = yup.object({
  name: yup.string().required('El nombre es obligatorio').min(2, 'El nombre debe tener al menos 2 caracteres'),
  surname: yup.string().required('El apellido es obligatorio').min(2, 'El apellido debe tener al menos 2 caracteres'),
  dni: yup.string().required('El DNI es obligatorio').matches(/^\d{8}[A-Z]$/, 'El DNI debe tener 8 números y una letra'),
  birthDate: yup.string().required('La fecha de nacimiento es obligatoria'),
  reportType: yup.string().oneOf(['Geneped', 'Medicaes'], 'Debe seleccionar un tipo de informe').required('El tipo de informe es obligatorio'),
  report: yup.string().required('El informe clínico es obligatorio').min(10, 'El informe clínico debe tener al menos 10 caracteres'),
  requestedTests: yup.string().optional().nullable()
}).required();

type FormData = yup.InferType<typeof schema>;

const EditRecord: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    watch,
    setValue
  } = useForm<FormData>({
    resolver: yupResolver(schema)
  });

  // Función para manejar la carga de archivos
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  // Función para eliminar archivos
  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Funciones para drag and drop de archivos
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => {
      const validTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      return validTypes.includes(fileExtension);
    });
    
    if (validFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const loadRecord = useCallback(async () => {
    try {
      setLoading(true);
      
      if (!user?.uid) {
        setError('No se pudo obtener la información del usuario.');
        return;
      }
      
      const recordData = await medicalRecordService.getById(id!, user.uid);
      if (!recordData) {
        setError('Registro no encontrado o no tienes permisos para acceder a él');
        return;
      }

      setRecord(recordData);
      
      // Cargar datos del paciente
      const patientData = await patientService.getById(recordData.patientId);
      setPatient(patientData);

      // Prellenar el formulario
      reset({
        name: recordData.patientName,
        surname: recordData.patientSurname,
        dni: recordData.patientDni,
        birthDate: recordData.patientBirthDate,
        reportType: recordData.reportType,
        report: recordData.report,
        requestedTests: recordData.requestedTests || ''
      });
    } catch (error) {
      console.error('Error cargando registro:', error);
      setError('Error al cargar el registro');
    } finally {
      setLoading(false);
    }
  }, [id, reset, user]);

  useEffect(() => {
    if (id) {
      loadRecord();
    }
  }, [id, loadRecord]);

  const onSubmit = async (data: FormData) => {
    if (!record || !patient || !user?.uid) return;

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      let documentUrls: string[] = [];
      if (uploadedFiles.length > 0) {
        documentUrls = await storageService.uploadDocuments(uploadedFiles, patient.id!);
      }

      const allDocuments = [
        ...(record.uploadedDocuments || []),
        ...documentUrls
      ];

      await patientService.update(patient.id!, {
        name: data.name,
        surname: data.surname,
        dni: data.dni,
        birthDate: data.birthDate
      });

      // Crear el objeto de actualización sin campos undefined
      const updateData: any = {
        patientName: data.name,
        patientSurname: data.surname,
        patientDni: data.dni,
        patientBirthDate: data.birthDate,
        reportType: data.reportType,
        report: data.report
      };

      // Solo añadir campos si tienen valores válidos
      if (data.requestedTests?.trim()) {
        updateData.requestedTests = data.requestedTests.trim();
      }

      if (allDocuments.length > 0) {
        updateData.uploadedDocuments = allDocuments;
      }

      await medicalRecordService.update(record.id!, updateData);

      setSuccess(true);
      setTimeout(() => {
        navigate('/history');
      }, 2000);
    } catch (error) {
      console.error('Error al actualizar el registro:', error);
      setError('Error al actualizar el registro. Por favor, inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const generateNewPDF = async () => {
    if (!record) return;
    try {
      // Generar PDF protegido
      await pdfService.generateProtectedPDF(record);
      const password = pdfService.generatePassword(record.patientDni);
      // No descargar automáticamente por razones de confidencialidad
      // pdfService.downloadPDF(pdfFile);
      alert(`✅ PDF protegido generado. Contraseña: ${password}`);
      alert('📄 El PDF se puede descargar desde el historial cuando sea necesario.');
    } catch (error) {
      alert('❌ Error al generar el PDF protegido.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="text-pastel-gray-dark">Cargando registro...</p>
        </div>
      </div>
    );
  }

  if (error && !record) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-red-700 mb-2">Error</h2>
          <p className="text-red-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/history')}
            className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-xl text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al Historial
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-6 space-y-4 lg:space-y-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/history')}
              className="inline-flex items-center px-3 py-2 border border-primary-300 text-sm font-medium rounded-xl text-primary-700 bg-white hover:bg-pastel-gray-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </button>
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-gentle">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-primary-700">Editar Registro Médico</h1>
              <p className="text-pastel-gray-dark text-sm">
                Modifica los datos del paciente y el informe clínico
              </p>
            </div>
          </div>
          
          <button
            onClick={generateNewPDF}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 shadow-gentle hover:shadow-soft"
          >
            <Download className="h-4 w-4 mr-2" />
            Regenerar PDF
          </button>
        </div>

        {/* Mensajes de estado */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center space-x-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">✅ Registro actualizado exitosamente</span>
            </div>
            <p className="text-green-600 text-sm mt-1">
              Redirigiendo al historial...
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center space-x-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">❌ Error</span>
            </div>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        )}
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 sm:p-8">
          {/* Datos del Paciente */}
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-pastel-blue to-pastel-blue-light rounded-lg flex items-center justify-center">
                <User className="h-5 w-5 text-primary-700" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-primary-700">Datos del Paciente</h2>
                <p className="text-pastel-gray-dark text-sm">Información personal del paciente</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Nombre *
                </label>
                <input
                  {...register('name')}
                  type="text"
                  className="w-full px-3 sm:px-4 py-3 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="Nombre del paciente"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Apellidos *
                </label>
                <input
                  {...register('surname')}
                  type="text"
                  className="w-full px-3 sm:px-4 py-3 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="Apellidos del paciente"
                />
                {errors.surname && (
                  <p className="mt-1 text-sm text-red-600">{errors.surname.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  DNI *
                </label>
                <input
                  {...register('dni')}
                  type="text"
                  className="w-full px-3 sm:px-4 py-3 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="12345678A"
                />
                {errors.dni && (
                  <p className="mt-1 text-sm text-red-600">{errors.dni.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Fecha de Nacimiento *
                </label>
                <input
                  {...register('birthDate')}
                  type="date"
                  className="w-full px-3 sm:px-4 py-3 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                />
                {errors.birthDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.birthDate.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Documentos existentes */}
          {record?.uploadedDocuments && record.uploadedDocuments.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-pastel-blue to-pastel-blue-light rounded-lg flex items-center justify-center">
                  <File className="h-5 w-5 text-primary-700" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-primary-700">Documentos Adjuntos</h2>
                  <p className="text-pastel-gray-dark text-sm">Documentos ya subidos para este paciente</p>
                </div>
              </div>

              <div className="space-y-2">
                {record.uploadedDocuments.map((url, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-pastel-gray-light rounded-lg">
                    <div className="flex items-center space-x-3">
                      <File className="h-4 w-4 text-primary-500" />
                      <div>
                        <p className="text-sm font-medium text-primary-700">
                          Documento {index + 1}
                        </p>
                        <p className="text-xs text-primary-500">
                          {url.split('/').pop()}
                        </p>
                      </div>
                    </div>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-primary-500 hover:text-primary-700 transition-colors duration-200"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Carga de nuevos documentos */}
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-pastel-blue to-pastel-blue-light rounded-lg flex items-center justify-center">
                <Upload className="h-5 w-5 text-primary-700" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-primary-700">Añadir Documentos</h2>
                <p className="text-pastel-gray-dark text-sm">Sube nuevos documentos para este paciente</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Área de carga */}
              <div 
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 ${
                  isDragOver 
                    ? 'border-primary-500 bg-primary-50' 
                    : 'border-pastel-gray-light hover:border-primary-300'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload-edit"
                />
                <label htmlFor="file-upload-edit" className="cursor-pointer">
                  <Upload className={`h-8 w-8 mx-auto mb-2 ${
                    isDragOver ? 'text-primary-600' : 'text-primary-400'
                  }`} />
                  <p className="text-sm text-primary-600 mb-1">
                    <span className="font-medium text-primary-700">Haz clic para subir</span> o arrastra los archivos aquí
                  </p>
                  <p className="text-xs text-primary-500">
                    PDF, DOC, DOCX, JPG, PNG (máx. 10MB por archivo)
                  </p>
                  {isDragOver && (
                    <p className="text-sm text-primary-600 font-medium mt-2">
                      Suelta los archivos aquí
                    </p>
                  )}
                </label>
              </div>

              {/* Lista de archivos subidos */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-primary-700">Archivos a subir:</h4>
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-pastel-gray-light">
                      <div className="flex items-center space-x-3">
                        <File className="h-4 w-4 text-primary-500" />
                        <div>
                          <p className="text-sm font-medium text-primary-700">{file.name}</p>
                          <p className="text-xs text-primary-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="p-1 text-red-500 hover:text-red-700 transition-colors duration-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* {uploadingFiles && (
                <div className="flex items-center space-x-2 text-primary-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                  <span className="text-sm">Subiendo documentos...</span>
                </div>
              )} */}
            </div>
          </div>

          {/* Pruebas solicitadas */}
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-pastel-blue to-pastel-blue-light rounded-lg flex items-center justify-center">
                <TestTube className="h-5 w-5 text-primary-700" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-primary-700">Pruebas Solicitadas</h2>
                <p className="text-pastel-gray-dark text-sm">Pruebas solicitadas para el paciente (opcional)</p>
              </div>
            </div>
            <div>
              <label htmlFor="requestedTests" className="block text-sm font-medium text-primary-700 mb-2">
                Pruebas solicitadas
              </label>
              <textarea
                id="requestedTests"
                {...register('requestedTests')}
                rows={3}
                className="w-full px-4 py-3 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 resize-none"
                placeholder="Especifica las pruebas solicitadas para el paciente (opcional)..."
              />
            </div>
          </div>

          {/* Tipo de Informe */}
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-pastel-blue to-pastel-blue-light rounded-lg flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary-700" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-primary-700">Tipo de Informe</h2>
                <p className="text-pastel-gray-dark text-sm">Selecciona el tipo de informe clínico</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="flex items-center space-x-4 p-4 border border-pastel-gray-light rounded-xl hover:bg-pastel-gray-light transition-all duration-200">
                <input
                  {...register('reportType')}
                  type="radio"
                  value="Geneped"
                  id="geneped"
                  className="w-4 h-4 text-primary-600 border-pastel-gray-light focus:ring-primary-500"
                />
                <label htmlFor="geneped" className="flex items-center space-x-3 cursor-pointer">
                  <img src="/logo.png" alt="Geneped" className="w-8 h-8 object-contain" />
                  <span className="text-sm font-medium text-primary-700">Geneped</span>
                </label>
              </div>

              <div className="flex items-center space-x-4 p-4 border border-pastel-gray-light rounded-xl hover:bg-pastel-gray-light transition-all duration-200">
                <input
                  {...register('reportType')}
                  type="radio"
                  value="Medicaes"
                  id="medicaes"
                  className="w-4 h-4 text-primary-600 border-pastel-gray-light focus:ring-primary-500"
                />
                <label htmlFor="medicaes" className="flex items-center space-x-3 cursor-pointer">
                  <img src="/Medicaes.png" alt="Medicaes" className="w-8 h-8 object-contain" />
                  <span className="text-sm font-medium text-primary-700">Medicaes</span>
                </label>
              </div>
            </div>
            {errors.reportType && (
              <p className="mt-2 text-sm text-red-600">{errors.reportType.message}</p>
            )}
          </div>

          {/* Informe Clínico */}
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-pastel-blue to-pastel-blue-light rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary-700" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-primary-700">Informe Clínico</h2>
                <p className="text-pastel-gray-dark text-sm">Informe clínico detallado del paciente</p>
              </div>
            </div>
            <div>
              <label htmlFor="report" className="block text-sm font-medium text-primary-700 mb-2">
                Informe Clínico *
              </label>
              <ProfessionalEditor
                value={watch('report') || ''}
                onChange={(value) => setValue('report', value)}
                placeholder="Escribe el informe clínico aquí..."
                className="w-full"
              />
              {errors.report && (
                <p className="mt-2 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.report.message}
                </p>
              )}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center space-y-3 sm:space-y-0 pt-6 border-t border-pastel-gray-light">
            <button
              type="button"
              onClick={() => navigate('/history')}
              className="inline-flex items-center justify-center px-6 py-3 border border-primary-300 text-sm font-medium rounded-xl text-primary-700 bg-white hover:bg-pastel-gray-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al historial
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar cambios
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditRecord; 