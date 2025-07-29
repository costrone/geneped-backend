import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useParams, useNavigate } from 'react-router-dom';
import { medicalRecordService, patientService } from '../services/firebase';
import { pdfService } from '../services/pdfService';
import { MedicalRecord, Patient } from '../types';
import { FileText, Download, AlertCircle, CheckCircle, User, Shield, ArrowLeft, Save } from 'lucide-react';

const schema = yup.object({
  name: yup.string().required('El nombre es obligatorio'),
  surname: yup.string().required('Los apellidos son obligatorios'),
  dni: yup.string().required('El DNI es obligatorio').matches(/^\d{8}[A-Z]$/, 'DNI debe tener 8 dígitos y una letra'),
  birthDate: yup.string().required('La fecha de nacimiento es obligatoria'),
  reportType: yup.string().oneOf(['Geneped', 'Medicaes'], 'Debe seleccionar un tipo de informe').required('El tipo de informe es obligatorio'),
  report: yup.string().required('El informe clínico es obligatorio').min(10, 'El informe clínico debe tener al menos 10 caracteres')
}).required();

type FormData = yup.InferType<typeof schema>;

const EditRecord: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<FormData>({
    resolver: yupResolver(schema)
  });

  const loadRecord = useCallback(async () => {
    try {
      setLoading(true);
      const recordData = await medicalRecordService.getById(id!);
      if (!recordData) {
        setError('Registro no encontrado');
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
        report: recordData.report
      });
    } catch (error) {
      console.error('Error cargando registro:', error);
      setError('Error al cargar el registro');
    } finally {
      setLoading(false);
    }
  }, [id, reset]);

  useEffect(() => {
    if (id) {
      loadRecord();
    }
  }, [id, loadRecord]);

  const onSubmit = async (data: FormData) => {
    if (!record || !patient) return;

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      // Actualizar datos del paciente
      await patientService.update(patient.id!, {
        name: data.name,
        surname: data.surname,
        dni: data.dni,
        birthDate: data.birthDate
      });

      // Actualizar el historial médico
      await medicalRecordService.update(record.id!, {
        patientName: data.name,
        patientSurname: data.surname,
        patientDni: data.dni,
        patientBirthDate: data.birthDate,
        reportType: data.reportType,
        report: data.report
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/history');
      }, 2000);
    } catch (error) {
      console.error('Error actualizando el registro:', error);
      setError('Error al actualizar el registro. Por favor, inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const generateNewPDF = async () => {
    if (!record) return;

    try {
      // Generar PDF sin contraseña
      const pdfFile = await pdfService.generatePDF(record);
      
      // Descargar el PDF
      pdfService.downloadPDF(pdfFile);
      
      alert(`✅ PDF regenerado exitosamente!\n\nEl PDF se ha descargado automáticamente.`);
    } catch (error) {
      console.error('Error generando PDF:', error);
      alert('❌ Error al generar el PDF. Por favor, inténtalo de nuevo.');
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
        <div className="flex items-center justify-between mb-6">
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
              <h1 className="text-2xl font-bold text-primary-700">Editar Registro Médico</h1>
              <p className="text-pastel-gray-dark text-sm">
                Modifica los datos del paciente y el informe clínico
              </p>
            </div>
          </div>
          
          <button
            onClick={generateNewPDF}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 shadow-gentle hover:shadow-soft"
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
        <form onSubmit={handleSubmit(onSubmit)} className="p-8">
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Nombre *
                </label>
                <input
                  {...register('name')}
                  type="text"
                  className="w-full px-4 py-3 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
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
                  className="w-full px-4 py-3 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
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
                  className="w-full px-4 py-3 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
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
                  className="w-full px-4 py-3 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                />
                {errors.birthDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.birthDate.message}</p>
                )}
              </div>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <p className="text-pastel-gray-dark text-sm">Redacta el informe clínico detallado</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700 mb-2">
                Informe Clínico *
              </label>
              <textarea
                {...register('report')}
                rows={8}
                className="w-full px-4 py-3 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 resize-none"
                placeholder="Escribe aquí el informe clínico detallado del paciente..."
              />
              {errors.report && (
                <p className="mt-1 text-sm text-red-600">{errors.report.message}</p>
              )}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-pastel-gray-light">
            <button
              type="button"
              onClick={() => navigate('/history')}
              className="inline-flex items-center px-6 py-3 border border-primary-300 text-sm font-medium rounded-xl text-primary-700 bg-white hover:bg-pastel-gray-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
            >
              Cancelar
            </button>
            
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 shadow-gentle hover:shadow-soft disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditRecord; 