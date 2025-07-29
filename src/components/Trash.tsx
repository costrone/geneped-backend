import React, { useState, useEffect } from 'react';
import { medicalRecordService } from '../services/firebase';
import { MedicalRecord } from '../types';
import { Trash2, RotateCcw, Calendar, User, Clock, AlertTriangle, Download, Eye, Wrench } from 'lucide-react';
import { pdfService } from '../services/pdfService';

const Trash: React.FC = () => {
  const [deletedRecords, setDeletedRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cleaningUp, setCleaningUp] = useState(false);

  useEffect(() => {
    loadDeletedRecords();
  }, []);

  const loadDeletedRecords = async () => {
    try {
      setLoading(true);
      const data = await medicalRecordService.getDeleted();
      setDeletedRecords(data);
    } catch (error) {
      console.error('Error cargando registros eliminados:', error);
      setError('Error al cargar los registros eliminados');
    } finally {
      setLoading(false);
    }
  };

  const restoreRecord = async (record: MedicalRecord) => {
    if (window.confirm(`¿Estás seguro de que quieres restaurar el registro de ${record.patientName} ${record.patientSurname}?`)) {
      try {
        console.log('Restaurando registro:', record.id);
        await medicalRecordService.restore(record.id!);
        alert('✅ Registro restaurado exitosamente');
        loadDeletedRecords(); // Recargar la lista
      } catch (error) {
        console.error('Error restaurando registro:', error);
        alert('❌ Error al restaurar el registro. Por favor, inténtalo de nuevo.');
      }
    }
  };

  const permanentlyDeleteRecord = async (record: MedicalRecord) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar definitivamente el registro de ${record.patientName} ${record.patientSurname}?\n\n⚠️ Esta acción NO se puede deshacer.`)) {
      try {
        console.log('Eliminando definitivamente:', record.id);
        await medicalRecordService.delete(record.id!);
        alert('✅ Registro eliminado definitivamente');
        loadDeletedRecords(); // Recargar la lista
      } catch (error) {
        console.error('Error eliminando registro:', error);
        alert('❌ Error al eliminar el registro. Por favor, inténtalo de nuevo.');
      }
    }
  };

  const cleanupOldRecords = async () => {
    if (window.confirm('¿Estás seguro de que quieres limpiar todos los registros eliminados hace más de 30 días?\n\n⚠️ Esta acción NO se puede deshacer.')) {
      try {
        setCleaningUp(true);
        const deletedCount = await medicalRecordService.cleanupOldDeleted();
        alert(`✅ Limpieza completada: ${deletedCount} registros eliminados definitivamente`);
        loadDeletedRecords(); // Recargar la lista
      } catch (error) {
        console.error('Error en limpieza:', error);
        alert('❌ Error durante la limpieza. Por favor, inténtalo de nuevo.');
      } finally {
        setCleaningUp(false);
      }
    }
  };

  const downloadPDF = async (record: MedicalRecord) => {
    try {
      // Generar PDF protegido
      const pdfFile = await pdfService.generateProtectedPDF(record);
      const password = pdfService.generatePassword(record.patientDni);
      pdfService.downloadPDF(pdfFile);
      alert(`✅ PDF protegido descargado. Contraseña: ${password}`);
    } catch (error) {
      alert('❌ Error al descargar el PDF protegido.');
    }
  };

  const viewRecord = (record: MedicalRecord) => {
    console.log('Viendo registro:', record.id);
    
    const details = `
📋 DETALLES DEL REGISTRO ELIMINADO

👤 Paciente: ${record.patientName} ${record.patientSurname}
🆔 DNI: ${record.patientDni}
📅 Fecha de Nacimiento: ${new Date(record.patientBirthDate).toLocaleDateString('es-ES')}
📅 Fecha del Informe: ${formatDate(record.createdAt)}
🕐 Hora: ${formatTime(record.createdAt)}
🏥 Tipo: ${record.reportType}
🗑️ Eliminado: ${formatDate(record.deletedAt)}

📝 INFORME CLÍNICO:
${record.report}

🔐 Contraseña PDF: ${pdfService.generatePassword(record.patientDni)}
    `;
    
    alert(details);
  };

  const formatDate = (date: Date | any) => {
    if (!date) return 'N/A';
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleDateString('es-ES');
  };

  const formatTime = (date: Date | any) => {
    if (!date) return 'N/A';
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const getDaysUntilPermanentDeletion = (deletedAt: Date) => {
    const thirtyDaysFromDeletion = new Date(deletedAt);
    thirtyDaysFromDeletion.setDate(thirtyDaysFromDeletion.getDate() + 30);
    
    const now = new Date();
    const diffTime = thirtyDaysFromDeletion.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="text-pastel-gray-dark">Cargando papelera...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-gentle">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Papelera de Reciclaje</h2>
                <p className="text-red-100 text-sm">
                  {deletedRecords.length} registros eliminados
                </p>
              </div>
            </div>
            
            <button
              onClick={cleanupOldRecords}
              disabled={cleaningUp}
              className="inline-flex items-center px-4 py-2 border border-white/20 text-sm font-medium rounded-xl text-white bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-all duration-200 shadow-gentle hover:shadow-soft disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wrench className="h-4 w-4 mr-2" />
              {cleaningUp ? 'Limpiando...' : 'Limpiar Antiguos'}
            </button>
          </div>
        </div>

        {/* Información de la papelera */}
        <div className="px-8 py-4 bg-red-50 border-b border-red-200">
          <div className="flex items-center space-x-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm">
              Los registros se eliminan automáticamente después de 30 días. 
              Puedes restaurarlos antes de que se eliminen definitivamente.
            </p>
          </div>
        </div>

        {/* Lista de registros eliminados */}
        <div className="overflow-hidden">
          {error && (
            <div className="px-8 py-4 text-red-600 bg-red-50 border-b border-red-200">
              {error}
            </div>
          )}

          {deletedRecords.length === 0 ? (
            <div className="px-8 py-12 text-center">
              <Trash2 className="mx-auto h-12 w-12 text-pastel-gray-dark" />
              <h3 className="mt-2 text-sm font-medium text-primary-700">La papelera está vacía</h3>
              <p className="mt-1 text-sm text-pastel-gray-dark">
                No hay registros eliminados para mostrar.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-pastel-gray-light">
              {deletedRecords.map((record) => {
                const daysLeft = getDaysUntilPermanentDeletion(record.deletedAt!);
                const isExpiringSoon = daysLeft <= 7;
                
                return (
                  <div key={record.id} className="px-8 py-6 hover:bg-red-50 transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                            <User className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-primary-700">
                              {record.patientName} {record.patientSurname}
                            </h3>
                            <p className="text-sm text-pastel-gray-dark">DNI: {record.patientDni}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4 text-sm text-pastel-gray-dark mb-3">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <span>Eliminado: {formatDate(record.deletedAt)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4" />
                            <span>{formatTime(record.deletedAt)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-xs bg-pastel-blue text-primary-700 px-2 py-1 rounded-lg">
                              {record.reportType}
                            </span>
                          </div>
                        </div>
                        
                        {/* Advertencia de expiración */}
                        {isExpiringSoon && (
                          <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                            <div className="flex items-center space-x-2 text-yellow-700">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                ⚠️ Este registro se eliminará definitivamente en {daysLeft} día{daysLeft !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        <p className="text-sm text-pastel-gray-dark line-clamp-2 leading-relaxed">
                          {record.report.substring(0, 200)}...
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-6">
                        <button
                          onClick={() => viewRecord(record)}
                          className="inline-flex items-center px-3 py-2 border border-primary-300 text-sm font-medium rounded-xl text-primary-700 bg-white hover:bg-pastel-gray-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
                          title="Ver detalles"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        
                        <button
                          onClick={() => downloadPDF(record)}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
                          title="Descargar PDF"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        
                        <button
                          onClick={() => restoreRecord(record)}
                          className="inline-flex items-center px-3 py-2 border border-green-300 text-sm font-medium rounded-xl text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200"
                          title="Restaurar registro"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                        
                        <button
                          onClick={() => permanentlyDeleteRecord(record)}
                          className="inline-flex items-center px-3 py-2 border border-red-300 text-sm font-medium rounded-xl text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200"
                          title="Eliminar definitivamente"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Trash; 