import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { medicalRecordService, patientService } from '../services/firebase';
import { pdfService } from '../services/pdfService';
import { MedicalRecord } from '../types';
import { FileText, Download, AlertCircle, CheckCircle, User, Shield } from 'lucide-react';

const schema = yup.object({
  name: yup.string().required('El nombre es obligatorio'),
  surname: yup.string().required('Los apellidos son obligatorios'),
  dni: yup.string().required('El DNI es obligatorio').matches(/^\d{8}[A-Z]$/, 'DNI debe tener 8 dígitos y una letra'),
  report: yup.string().required('El informe es obligatorio').min(10, 'El informe debe tener al menos 10 caracteres')
}).required();

type FormData = yup.InferType<typeof schema>;

const CreateRecord: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [generatedPDF, setGeneratedPDF] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<FormData>({
    resolver: yupResolver(schema)
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError('');
    setSuccess(false);
    setGeneratedPDF(null);

    try {
      // Crear el paciente
      const patientId = await patientService.create({
        name: data.name,
        surname: data.surname,
        dni: data.dni
      });

      // Crear el historial médico
      const record: Omit<MedicalRecord, 'id' | 'createdAt' | 'updatedAt'> = {
        patientId,
        patientName: data.name,
        patientSurname: data.surname,
        patientDni: data.dni,
        report: data.report,
        password: pdfService.generatePassword(data.dni)
      };

      const recordId = await medicalRecordService.create(record);

      // Generar PDF protegido
      const { file: pdfFile, password } = await pdfService.generateProtectedPDF({
        ...record,
        id: recordId,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      setGeneratedPDF(pdfFile);
      alert(`PDF generado con contraseña: ${password}`);
      setSuccess(true);
      reset();
    } catch (error) {
      console.error('Error al crear el historial:', error);
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
              <h2 className="text-2xl font-bold text-primary-700">Nuevo Historial Médico</h2>
              <p className="text-primary-600 text-sm">
                Introduce los datos del paciente y redacta el informe médico
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-8">
          {/* Datos del paciente */}
          <div className="bg-pastel-gray-light rounded-xl p-6">
            <div className="flex items-center space-x-2 mb-4">
              <User className="h-5 w-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-primary-700">Datos del Paciente</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-primary-700 mb-2">
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
                <label htmlFor="surname" className="block text-sm font-medium text-primary-700 mb-2">
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
                <label htmlFor="dni" className="block text-sm font-medium text-primary-700 mb-2">
                  DNI *
                </label>
                <input
                  type="text"
                  id="dni"
                  {...register('dni')}
                  className="w-full px-4 py-3 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="12345678A"
                  maxLength={9}
                />
                {errors.dni && (
                  <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                    <AlertCircle className="h-4 w-4" />
                    <span>{errors.dni.message}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Informe médico */}
          <div className="bg-pastel-gray-light rounded-xl p-6">
            <div className="flex items-center space-x-2 mb-4">
              <FileText className="h-5 w-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-primary-700">Informe Médico</h3>
            </div>
            
            <div>
              <label htmlFor="report" className="block text-sm font-medium text-primary-700 mb-2">
                Informe Médico *
              </label>
              <textarea
                id="report"
                rows={12}
                {...register('report')}
                className="w-full px-4 py-3 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 resize-none"
                placeholder="Redacta aquí el informe médico completo..."
              />
              {errors.report && (
                <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.report.message}</span>
                </p>
              )}
            </div>
          </div>

          {/* Mensajes de estado */}
          {error && (
            <div className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <span className="text-green-700">Historial creado exitosamente</span>
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-between items-center pt-6 border-t border-pastel-gray-light">
            <div className="flex items-center space-x-2 text-sm text-pastel-gray-dark">
              <Shield className="h-4 w-4" />
              <span>El PDF se generará con protección de contraseña</span>
            </div>
            
            <div className="flex space-x-4">
              {generatedPDF && (
                <button
                  type="button"
                  onClick={downloadPDF}
                  className="inline-flex items-center px-6 py-3 border border-primary-300 text-sm font-medium rounded-xl text-primary-700 bg-white hover:bg-pastel-gray-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 shadow-gentle hover:shadow-soft"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar PDF
                </button>
              )}
              
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-gentle hover:shadow-soft"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Generando...</span>
                  </div>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
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