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
  birthDate: yup.string().required('La fecha de nacimiento es obligatoria'),
  reportType: yup.string().oneOf(['Geneped', 'Medicaes'], 'Debe seleccionar un tipo de informe').required('El tipo de informe es obligatorio'),
  report: yup.string().required('El informe clínico es obligatorio').min(10, 'El informe clínico debe tener al menos 10 caracteres')
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
        dni: data.dni,
        birthDate: data.birthDate
      });

      // Crear el historial médico
      const record: Omit<MedicalRecord, 'id' | 'createdAt' | 'updatedAt'> = {
        patientId,
        patientName: data.name,
        patientSurname: data.surname,
        patientDni: data.dni,
        patientBirthDate: data.birthDate,
        reportType: data.reportType,
        report: data.report,
        password: pdfService.generatePassword(data.dni)
      };

      const recordId = await medicalRecordService.create(record);

      // Generar PDF protegido
      const pdfFile = await pdfService.generateProtectedPDF({
        ...record,
        id: recordId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      const password = record.password;
      pdfService.downloadPDF(pdfFile);
      alert(`✅ Documento generado y protegido con contraseña: ${password}`);
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
              <h3 className="text-lg font-semibold text-primary-700">Datos del Paciente</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                />
                {errors.dni && (
                  <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                    <AlertCircle className="h-4 w-4" />
                    <span>{errors.dni.message}</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="birthDate" className="block text-sm font-medium text-primary-700 mb-2">
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

          {/* Tipo de informe */}
          <div className="bg-pastel-gray-light rounded-xl p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Shield className="h-5 w-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-primary-700">Tipo de Informe</h3>
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
                    <img src="/logo.png" alt="Geneped" className="w-8 h-8 object-contain" />
                    <span className="text-sm font-medium text-primary-700">Geneped</span>
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
                    <img src="/medicaes.png" alt="Medicaes" className="w-8 h-8 object-contain" />
                    <span className="text-sm font-medium text-primary-700">Medicaes</span>
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
              <h3 className="text-lg font-semibold text-primary-700">Informe Clínico</h3>
            </div>

            <div>
              <label htmlFor="report" className="block text-sm font-medium text-primary-700 mb-2">
                Informe Clínico *
              </label>
              <textarea
                id="report"
                {...register('report')}
                rows={8}
                className="w-full px-4 py-3 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 resize-none"
                placeholder="Redacta el informe clínico detallado del paciente..."
              />
              {errors.report && (
                <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.report.message}</span>
                </p>
              )}
            </div>
          </div>

          {/* Botones */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {success && (
                <div className="flex items-center space-x-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">Historial creado exitosamente</span>
                </div>
              )}
              {error && (
                <div className="flex items-center space-x-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-3">
              {generatedPDF && (
                <button
                  type="button"
                  onClick={downloadPDF}
                  className="inline-flex items-center px-4 py-2 border border-primary-300 text-sm font-medium rounded-xl text-primary-700 bg-white hover:bg-pastel-gray-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
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
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generando...
                  </>
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