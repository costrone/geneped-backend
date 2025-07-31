import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { medicalRecordService } from '../services/firebase';
import { MedicalRecord, SearchFilters } from '../types';
import { Search, Filter, Download, Eye, Calendar, User, FileText, Clock, Trash2, Edit, Mail, Receipt, CreditCard } from 'lucide-react';
import { pdfService } from '../services/pdfService';
import { useUser } from '../contexts/UserContext';

const RecordHistory: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      console.log('Usuario autenticado:', user?.email);
      console.log('Cargando registros...');
      const data = await medicalRecordService.getAll();
      console.log('Registros cargados:', data.length);
      setRecords(data);
    } catch (error) {
      console.error('Error cargando registros:', error);
      setError(`Error al cargar los registros: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleFilterChange = (key: keyof SearchFilters, value: string | Date | boolean | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const applyFilters = useCallback(() => {
    let filtered = [...records];

    if (filters.name) {
      filtered = filtered.filter(record =>
        record.patientName.toLowerCase().includes(filters.name!.toLowerCase())
      );
    }

    if (filters.surname) {
      filtered = filtered.filter(record =>
        record.patientSurname.toLowerCase().includes(filters.surname!.toLowerCase())
      );
    }

    if (filters.dni) {
      filtered = filtered.filter(record =>
        record.patientDni.toLowerCase().includes(filters.dni!.toLowerCase())
      );
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(record =>
        record.createdAt >= filters.dateFrom!
      );
    }

    if (filters.dateTo) {
      filtered = filtered.filter(record =>
        record.createdAt <= filters.dateTo!
      );
    }

    if (filters.keywords) {
      filtered = filtered.filter(record =>
        record.report.toLowerCase().includes(filters.keywords!.toLowerCase())
      );
    }

    // Filtro por factura emitida
    if (filters.invoiceIssued !== undefined) {
      filtered = filtered.filter(record =>
        record.invoiceIssued === filters.invoiceIssued
      );
    }

    // Filtro por pagado
    if (filters.paid !== undefined) {
      filtered = filtered.filter(record =>
        record.paid === filters.paid
      );
    }

    // Ordenar por fecha de creación (más reciente primero)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setFilteredRecords(filtered);
  }, [records, filters]);

  useEffect(() => {
    if (user) {
      loadRecords();
    } else {
      console.log('Usuario no autenticado');
      setError('Usuario no autenticado');
      setLoading(false);
    }
  }, [user, loadRecords]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const clearFilters = () => {
    setFilters({});
  };

  const downloadPDF = async (record: MedicalRecord) => {
    try {
      const pdfFile = await pdfService.generateProtectedPDF(record);
      const password = pdfService.generatePassword(record.patientDni);
      pdfService.downloadPDF(pdfFile);
      alert(`✅ PDF protegido descargado. Contraseña: ${password}`);
    } catch (error) {
      alert('❌ Error al descargar el PDF protegido.');
    }
  };

  const sendProtectedEmail = async (record: MedicalRecord) => {
    if (!user?.email) {
      alert('❌ Error: No se pudo obtener tu email de usuario.');
      return;
    }

    try {
      setSendingEmail(record.id!);
      const recipientEmail = prompt('Introduce el email del destinatario:');
      
      if (!recipientEmail) {
        setSendingEmail(null);
        return;
      }

      await pdfService.sendProtectedPDFByEmail(record, recipientEmail, user.email);
      alert('✅ Email enviado exitosamente con enlace de descarga.');
    } catch (error) {
      console.error('Error enviando email:', error);
      alert(`❌ Error enviando email: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setSendingEmail(null);
    }
  };

  const viewRecord = (record: MedicalRecord) => {
    const message = `
📋 **Detalles del Registro Médico**

👤 **Paciente:** ${record.patientName} ${record.patientSurname}
🆔 **DNI:** ${record.patientDni}
📅 **Fecha de nacimiento:** ${new Date(record.patientBirthDate).toLocaleDateString('es-ES')}
📊 **Tipo de informe:** ${record.reportType}
📝 **Informe clínico:** ${record.report.substring(0, 200)}...
📅 **Fecha de creación:** ${formatDate(record.createdAt)}
⏰ **Hora:** ${formatTime(record.createdAt)}
${record.requestedTests ? `🧪 **Pruebas solicitadas:** ${record.requestedTests}` : ''}
${record.uploadedDocuments && record.uploadedDocuments.length > 0 ? `📎 **Documentos adjuntos:** ${record.uploadedDocuments.length} archivo(s)` : ''}
${record.invoiceIssued !== undefined ? `🧾 **Factura emitida:** ${record.invoiceIssued ? 'Sí' : 'No'}` : ''}
${record.paid !== undefined ? `💳 **Pagado:** ${record.paid ? 'Sí' : 'No'}` : ''}
    `;
    
    alert(message);
  };

  const deleteRecord = async (record: MedicalRecord) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar el registro de ${record.patientName} ${record.patientSurname}?`)) {
      try {
        await medicalRecordService.softDelete(record.id!);
        await loadRecords();
        alert('✅ Registro eliminado exitosamente.');
      } catch (error) {
        console.error('Error eliminando registro:', error);
        alert('❌ Error eliminando el registro.');
      }
    }
  };

  const editRecord = (record: MedicalRecord) => {
    navigate(`/edit/${record.id}`);
  };

  const formatDate = (date: Date | any) => {
    if (date instanceof Date) {
      return date.toLocaleDateString('es-ES');
    }
    if (date?.toDate) {
      return date.toDate().toLocaleDateString('es-ES');
    }
    return new Date(date).toLocaleDateString('es-ES');
  };

  const formatTime = (date: Date | any) => {
    if (date instanceof Date) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }
    if (date?.toDate) {
      return date.toDate().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }
    return new Date(date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="text-pastel-gray-dark">Cargando historiales...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <div className="bg-gradient-to-r from-pastel-blue to-pastel-blue-light px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-gentle">
                <FileText className="h-6 w-6 text-primary-700" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-primary-700">Historial de Registros</h2>
                <p className="text-primary-600 text-sm">
                  {filteredRecords.length} registros encontrados
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-4 py-2 border border-white/20 text-sm font-medium rounded-xl text-primary-700 bg-white/90 hover:bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 shadow-gentle hover:shadow-soft"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </button>
          </div>
        </div>

        {/* Filtros */}
        {showFilters && (
          <div className="px-8 py-6 border-b border-pastel-gray-light bg-pastel-gray-light">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">Nombre</label>
                <input
                  type="text"
                  value={filters.name || ''}
                  onChange={(e) => handleFilterChange('name', e.target.value || undefined)}
                  className="w-full px-4 py-2 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="Buscar por nombre..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">Apellidos</label>
                <input
                  type="text"
                  value={filters.surname || ''}
                  onChange={(e) => handleFilterChange('surname', e.target.value || undefined)}
                  className="w-full px-4 py-2 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="Buscar por apellidos..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">DNI</label>
                <input
                  type="text"
                  value={filters.dni || ''}
                  onChange={(e) => handleFilterChange('dni', e.target.value || undefined)}
                  className="w-full px-4 py-2 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="Buscar por DNI..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">Palabras clave</label>
                <input
                  type="text"
                  value={filters.keywords || ''}
                  onChange={(e) => handleFilterChange('keywords', e.target.value || undefined)}
                  className="w-full px-4 py-2 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="Buscar en el informe..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">Fecha desde</label>
                <input
                  type="date"
                  value={filters.dateFrom ? filters.dateFrom.toISOString().split('T')[0] : ''}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value ? new Date(e.target.value) : undefined)}
                  className="w-full px-4 py-2 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">Fecha hasta</label>
                <input
                  type="date"
                  value={filters.dateTo ? filters.dateTo.toISOString().split('T')[0] : ''}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value ? new Date(e.target.value) : undefined)}
                  className="w-full px-4 py-2 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  <Receipt className="h-4 w-4 inline mr-1" />
                  Factura emitida
                </label>
                <select
                  value={filters.invoiceIssued === undefined ? '' : filters.invoiceIssued ? 'true' : 'false'}
                  onChange={(e) => handleFilterChange('invoiceIssued', e.target.value === '' ? undefined : e.target.value === 'true')}
                  className="w-full px-4 py-2 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                >
                  <option value="">Todos</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  <CreditCard className="h-4 w-4 inline mr-1" />
                  Pagado
                </label>
                <select
                  value={filters.paid === undefined ? '' : filters.paid ? 'true' : 'false'}
                  onChange={(e) => handleFilterChange('paid', e.target.value === '' ? undefined : e.target.value === 'true')}
                  className="w-full px-4 py-2 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                >
                  <option value="">Todos</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-4 py-2 border border-primary-300 text-sm font-medium rounded-xl text-primary-700 bg-white hover:bg-pastel-gray-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        )}

        {/* Lista de registros */}
        <div className="overflow-hidden">
          {error && (
            <div className="px-8 py-4 text-red-600 bg-red-50 border-b border-red-200">
              {error}
            </div>
          )}

          {filteredRecords.length === 0 ? (
            <div className="px-8 py-12 text-center">
              <Search className="mx-auto h-12 w-12 text-pastel-gray-dark" />
              <h3 className="mt-2 text-sm font-medium text-primary-700">No se encontraron registros</h3>
              <p className="mt-1 text-sm text-pastel-gray-dark">
                {records.length === 0 ? 'No hay registros médicos.' : 'Intenta ajustar los filtros de búsqueda.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-pastel-gray-light">
              {filteredRecords.map((record) => (
                <div key={record.id} className="px-8 py-6 hover:bg-pastel-gray-light transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-pastel-blue to-pastel-blue-light rounded-lg flex items-center justify-center">
                          <User className="h-5 w-5 text-primary-700" />
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
                          <span>{formatDate(record.createdAt)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4" />
                          <span>{formatTime(record.createdAt)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="text-xs bg-pastel-blue text-primary-700 px-2 py-1 rounded-lg">
                            {record.reportType}
                          </span>
                        </div>
                        {record.invoiceIssued !== undefined && (
                          <div className="flex items-center space-x-1">
                            <Receipt className="h-4 w-4" />
                            <span className={`text-xs px-2 py-1 rounded-lg ${
                              record.invoiceIssued 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {record.invoiceIssued ? 'Facturado' : 'Sin facturar'}
                            </span>
                          </div>
                        )}
                        {record.paid !== undefined && (
                          <div className="flex items-center space-x-1">
                            <CreditCard className="h-4 w-4" />
                            <span className={`text-xs px-2 py-1 rounded-lg ${
                              record.paid 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {record.paid ? 'Pagado' : 'Pendiente'}
                            </span>
                          </div>
                        )}
                      </div>
                      
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
                        onClick={() => editRecord(record)}
                        className="inline-flex items-center px-3 py-2 border border-yellow-300 text-sm font-medium rounded-xl text-yellow-700 bg-white hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-all duration-200"
                        title="Editar registro"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      
                      <button
                        onClick={() => downloadPDF(record)}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
                        title="Descargar PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      
                      <button
                        onClick={() => sendProtectedEmail(record)}
                        disabled={sendingEmail === record.id}
                        className="inline-flex items-center px-3 py-2 border border-green-300 text-sm font-medium rounded-xl text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Enviar por email con enlace de descarga"
                      >
                        {sendingEmail === record.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                      </button>
                      
                      <button
                        onClick={() => deleteRecord(record)}
                        className="inline-flex items-center px-3 py-2 border border-red-300 text-sm font-medium rounded-xl text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200"
                        title="Eliminar registro"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordHistory; 