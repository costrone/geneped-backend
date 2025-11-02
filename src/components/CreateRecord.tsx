import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Download,
  AlertCircle,
  CheckCircle,
  User,
  Shield,
  Upload,
  X,
  File,
  TestTube,
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import {
  patientService,
  medicalRecordService,
  storageService,
  auth,
} from '../services/firebase';
import { pdfService } from '../services/pdfService';
import ProfessionalEditor from './ProfessionalEditor';

const schema = yup
  .object({
    name: yup
      .string()
      .required('El nombre es obligatorio')
      .min(2, 'El nombre debe tener al menos 2 caracteres'),
    surname: yup
      .string()
      .required('El apellido es obligatorio')
      .min(2, 'El apellido debe tener al menos 2 caracteres'),
    dni: yup
      .string()
      .required('El DNI es obligatorio')
      .matches(/^\d{8}[A-Z]$/, 'El DNI debe tener 8 números y una letra'),
    birthDate: yup.string().required('La fecha de nacimiento es obligatoria'),
    reportType: yup
      .string()
      .oneOf(['Geneped', 'Medicaes'], 'Debe seleccionar un tipo de informe')
      .required('El tipo de informe es obligatorio'),
    report: yup
      .string()
      .required('El informe clínico es obligatorio')
      .min(10, 'El informe clínico debe tener al menos 10 caracteres'),
    requestedTests: yup.string().optional().nullable(),
  })
  .required();

type FormData = yup.InferType<typeof schema>;

const CreateRecord: React.FC = () => {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [generatedPDF, setGeneratedPDF] = useState<File | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadedPDF, setUploadedPDF] = useState<File | null>(null);
  const [protectingPDF, setProtectingPDF] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPDFDragOver, setIsPDFDragOver] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: yupResolver(schema),
  });

  // Función para manejar la carga de archivos
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  // Función para eliminar un archivo
  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Función para manejar la carga de PDF
  const handlePDFUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setUploadedPDF(file);
    } else if (file) {
      alert('❌ Por favor, selecciona un archivo PDF válido.');
    }
  };

  // Función para eliminar PDF subido
  const removeUploadedPDF = () => {
    setUploadedPDF(null);
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

  // Funciones para drag and drop de PDF
  const handlePDFDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsPDFDragOver(true);
  };

  const handlePDFDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsPDFDragOver(false);
  };

  const handlePDFDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsPDFDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.type === 'application/pdf');

    if (pdfFile) {
      setUploadedPDF(pdfFile);
    } else if (files.length > 0) {
      alert('❌ Por favor, arrastra solo archivos PDF válidos.');
    }
  };

  // Función para proteger PDF subido
  const protectUploadedPDF = async () => {
    if (!uploadedPDF) return;

    setProtectingPDF(true);
    try {
      const password = pdfService.generatePassword(
        uploadedPDF.name.split('_')[0] || '12345678A'
      );
      const protectedPDF = await pdfService.generateProtectedPDFFromFile(
        uploadedPDF,
        password
      );

      // Descargar PDF protegido
      pdfService.downloadPDF(protectedPDF);

      alert(`✅ PDF protegido con contraseña: ${password}`);

      // Mostrar alerta de confidencialidad
      alert(
        '⚠️ Por motivos de confidencialidad le recomendamos que elimine el archivo subido de su dispositivo.'
      );
    } catch (error) {
      console.error('Error protegiendo PDF:', error);
      alert('❌ Error al proteger el PDF. Por favor, inténtalo de nuevo.');
    } finally {
      setProtectingPDF(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    console.log('=== INICIO onSubmit ===');
    console.log('Datos del formulario:', data);
    console.log('Usuario:', user);

    if (!user?.uid) {
      console.log('ERROR: No hay user.uid');
      setError(
        'No se pudo obtener la información del usuario. Por favor, inicia sesión nuevamente.'
      );
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);
    setGeneratedPDF(null);

    try {
      console.log('Iniciando creación del registro...');

      // Refrescar token para evitar request.auth null en reglas
      try {
        await auth.currentUser?.getIdToken(true);
      } catch (e) {
        console.warn(
          'No se pudo refrescar el token antes de escribir en Firestore',
          e
        );
      }

      console.log('Creando paciente...');
      const patientId = await patientService.create({
        userId: user.uid,
        name: data.name,
        surname: data.surname,
        dni: data.dni,
        birthDate: data.birthDate,
      });
      console.log('Paciente creado con ID:', patientId);

      // Subir documentos ahora que tenemos patientId
      let documentUrls: string[] = [];
      if (uploadedFiles.length > 0) {
        console.log('Subiendo archivos...');
        documentUrls = await storageService.uploadDocuments(
          uploadedFiles,
          patientId
        );
        console.log('Archivos subidos:', documentUrls);
      }

      // Crear el objeto del registro sin campos undefined
      const recordData: any = {
        userId: user.uid,
        patientId,
        patientName: data.name,
        patientSurname: data.surname,
        patientDni: data.dni,
        patientBirthDate: data.birthDate,
        reportType: data.reportType,
        report: data.report,
        invoiceIssued: false,
        paid: false,
        password: pdfService.generatePassword(data.dni),
      };

      // Solo añadir campos si tienen valores válidos
      if (data.requestedTests?.trim()) {
        recordData.requestedTests = data.requestedTests.trim();
      }

      if (documentUrls.length > 0) {
        recordData.uploadedDocuments = documentUrls;
      }

      console.log('Datos del registro a crear:', recordData);
      console.log('Llamando a medicalRecordService.create...');

      const recordId = await medicalRecordService.create(recordData);
      console.log('Registro creado con ID:', recordId);

      console.log('Generando PDF...');
      await pdfService.generateProtectedPDF({
        ...recordData,
        id: recordId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const password = recordData.password;
      // No descargar automáticamente por razones de confidencialidad
      // pdfService.downloadPDF(pdfFile);

      alert(`✅ Documento generado y protegido con contraseña: ${password}`);

      setSuccess(true);
      reset();
      setUploadedFiles([]);
      setUploadedPDF(null);

      console.log('=== FIN onSubmit - ÉXITO ===');

      // Navegar al historial después de crear el registro
      setTimeout(() => {
        navigate('/history');
      }, 2000);
    } catch (error) {
      console.error('=== ERROR en onSubmit ===', error);
      setError('Error al crear el historial. Por favor, inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    if (generatedPDF) {
      const url = URL.createObjectURL(generatedPDF);
      const a = document.createElement('a');
      a.href = url;
      a.download = generatedPDF.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <div className="bg-gradient-to-r from-pastel-blue to-pastel-blue-light px-8 py-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-gentle">
              <FileText className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-primary-700">
                Nuevo Historial Médico
              </h2>
              <p className="text-primary-600 text-sm">
                Introduce los datos del paciente y redacta el informe clínico
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-8">
          {/* Datos del paciente */}
          <div className="bg-pastel-gray-light rounded-xl p-6">
            <div className="flex items-center space-x-2 mb-4">
              <User className="h-5 w-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-primary-700">
                Datos del Paciente
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-primary-700 mb-2"
                >
                  Nombre *
                </label>
                <input
                  type="text"
                  id="name"
                  {...register('name')}
                  className="w-full px-4 py-3 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="Nombre del paciente"
                />
                {errors.name && (
                  <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                    <AlertCircle className="h-4 w-4" />
                    <span>{errors.name.message}</span>
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="surname"
                  className="block text-sm font-medium text-primary-700 mb-2"
                >
                  Apellidos *
                </label>
                <input
                  type="text"
                  id="surname"
                  {...register('surname')}
                  className="w-full px-4 py-3 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="Apellidos del paciente"
                />
                {errors.surname && (
                  <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                    <AlertCircle className="h-4 w-4" />
                    <span>{errors.surname.message}</span>
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="dni"
                  className="block text-sm font-medium text-primary-700 mb-2"
                >
                  DNI *
                </label>
                <input
                  type="text"
                  id="dni"
                  {...register('dni')}
                  className="w-full px-4 py-3 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="12345678A"
                />
                {errors.dni && (
                  <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                    <AlertCircle className="h-4 w-4" />
                    <span>{errors.dni.message}</span>
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="birthDate"
                  className="block text-sm font-medium text-primary-700 mb-2"
                >
                  Fecha de Nacimiento *
                </label>
                <input
                  type="date"
                  id="birthDate"
                  {...register('birthDate')}
                  className="w-full px-4 py-3 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                />
                {errors.birthDate && (
                  <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                    <AlertCircle className="h-4 w-4" />
                    <span>{errors.birthDate.message}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Carga de documentos */}
          <div className="bg-pastel-gray-light rounded-xl p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Upload className="h-5 w-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-primary-700">
                Documentos Adjuntos
              </h3>
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
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload
                    className={`h-8 w-8 mx-auto mb-2 ${
                      isDragOver ? 'text-primary-600' : 'text-primary-400'
                    }`}
                  />
                  <p className="text-sm text-primary-600 mb-1">
                    <span className="font-medium text-primary-700">
                      Haz clic para subir
                    </span>{' '}
                    o arrastra los archivos aquí
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
                  <h4 className="text-sm font-medium text-primary-700">
                    Archivos subidos:
                  </h4>
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-pastel-gray-light"
                    >
                      <div className="flex items-center space-x-3">
                        <File className="h-4 w-4 text-primary-500" />
                        <div>
                          <p className="text-sm font-medium text-primary-700">
                            {file.name}
                          </p>
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

          {/* Subir PDF directamente */}
          <div className="bg-pastel-gray-light rounded-xl p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Shield className="h-5 w-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-primary-700">
                Subir PDF Directamente
              </h3>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-primary-600 mb-4">
                Si ya tienes un PDF con la historia clínica, puedes subirlo
                directamente para protegerlo con contraseña.
              </p>

              {/* Área de carga de PDF */}
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 ${
                  isPDFDragOver
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-pastel-gray-light hover:border-primary-300'
                }`}
                onDragOver={handlePDFDragOver}
                onDragLeave={handlePDFDragLeave}
                onDrop={handlePDFDrop}
              >
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handlePDFUpload}
                  className="hidden"
                  id="pdf-upload"
                />
                <label htmlFor="pdf-upload" className="cursor-pointer">
                  <FileText
                    className={`h-8 w-8 mx-auto mb-2 ${
                      isPDFDragOver ? 'text-primary-600' : 'text-primary-400'
                    }`}
                  />
                  <p className="text-sm text-primary-600 mb-1">
                    <span className="font-medium text-primary-700">
                      Haz clic para subir PDF
                    </span>{' '}
                    o arrastra el archivo aquí
                  </p>
                  <p className="text-xs text-primary-500">
                    Solo archivos PDF (máx. 10MB)
                  </p>
                  {isPDFDragOver && (
                    <p className="text-sm text-primary-600 font-medium mt-2">
                      Suelta el PDF aquí
                    </p>
                  )}
                </label>
              </div>

              {/* PDF subido */}
              {uploadedPDF && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-pastel-gray-light">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-4 w-4 text-primary-500" />
                      <div>
                        <p className="text-sm font-medium text-primary-700">
                          {uploadedPDF.name}
                        </p>
                        <p className="text-xs text-primary-500">
                          {(uploadedPDF.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={protectUploadedPDF}
                        disabled={protectingPDF}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {protectingPDF ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Protegiendo...
                          </>
                        ) : (
                          <>
                            <Shield className="h-4 w-4 mr-2" />
                            Proteger PDF
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={removeUploadedPDF}
                        className="p-1 text-red-500 hover:text-red-700 transition-colors duration-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pruebas solicitadas */}
          <div className="bg-pastel-gray-light rounded-xl p-6">
            <div className="flex items-center space-x-2 mb-4">
              <TestTube className="h-5 w-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-primary-700">
                Pruebas Solicitadas
              </h3>
            </div>
            <div>
              <label
                htmlFor="requestedTests"
                className="block text-sm font-medium text-primary-700 mb-2"
              >
                Pruebas solicitadas (opcional)
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

          {/* Tipo de informe */}
          <div className="bg-pastel-gray-light rounded-xl p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Shield className="h-5 w-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-primary-700">
                Tipo de Informe
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center space-x-3 p-4 border border-pastel-gray-light rounded-xl cursor-pointer hover:bg-white transition-all duration-200">
                  <input
                    type="radio"
                    value="Geneped"
                    {...register('reportType')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-pastel-gray-light"
                  />
                  <div className="flex items-center space-x-3">
                    <img
                      src="/logo.png"
                      alt="Geneped"
                      className="w-8 h-8 object-contain"
                    />
                    <span className="text-sm font-medium text-primary-700">
                      Geneped
                    </span>
                  </div>
                </label>
              </div>

              <div>
                <label className="flex items-center space-x-3 p-4 border border-pastel-gray-light rounded-xl cursor-pointer hover:bg-white transition-all duration-200">
                  <input
                    type="radio"
                    value="Medicaes"
                    {...register('reportType')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-pastel-gray-light"
                  />
                  <div className="flex items-center space-x-3">
                    <img
                      src="/Medicaes.png"
                      alt="Medicaes"
                      className="w-8 h-8 object-contain"
                    />
                    <span className="text-sm font-medium text-primary-700">
                      Medicaes
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {errors.reportType && (
              <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                <AlertCircle className="h-4 w-4" />
                <span>{errors.reportType.message}</span>
              </p>
            )}
          </div>

          {/* Informe clínico */}
          <div className="bg-pastel-gray-light rounded-xl p-6">
            <div className="flex items-center space-x-2 mb-4">
              <FileText className="h-5 w-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-primary-700">
                Informe Clínico
              </h3>
            </div>
            <div>
              <label
                htmlFor="report"
                className="block text-sm font-medium text-primary-700 mb-2"
              >
                Informe Clínico *
              </label>
              <ProfessionalEditor
                value={watch('report') || ''}
                onChange={value => setValue('report', value)}
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

          {/* Botones */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between space-y-4 lg:space-y-0">
            <div className="flex items-center space-x-4">
              {success && (
                <div className="flex items-center space-x-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    Historial creado exitosamente
                  </span>
                </div>
              )}
              {error && (
                <div className="flex items-center space-x-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
              {generatedPDF && (
                <button
                  type="button"
                  onClick={downloadPDF}
                  className="inline-flex items-center justify-center px-4 py-3 sm:py-2 border border-primary-300 text-sm font-medium rounded-xl text-primary-700 bg-white hover:bg-pastel-gray-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar PDF
                </button>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 border border-transparent text-base sm:text-lg font-medium rounded-xl text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Generando documento...
                  </>
                ) : (
                  <>
                    <FileText className="h-5 w-5 mr-3" />
                    Generar Documento
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRecord;
