import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { medicalRecordService } from '../services/firebase';
import { MedicalRecord, SearchFilters } from '../types';
import { Search, Filter, Download, Eye, Calendar, User, FileText, Clock, Trash2, Edit, Mail, Receipt, CreditCard, RefreshCw, Paperclip, ExternalLink } from 'lucide-react';
import { pdfService } from '../services/pdfService';
import { useUser } from '../contexts/UserContext';
import { AlertTriangle } from 'lucide-react';
import InvoiceGenerator from './InvoiceGenerator';

const RecordHistory: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useUser();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [showInvoiceGenerator, setShowInvoiceGenerator] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      console.log('=== INICIO loadRecords ===');
      console.log('Usuario autenticado:', user?.email);
      console.log('User ID:', user?.uid);
      console.log('Cargando registros...');
      
      if (!user?.uid) {
        console.log('ERROR: No hay user.uid');
        setError('No se pudo obtener la información del usuario.');
        return;
      }
      
      console.log('Llamando a medicalRecordService.getAll...');
      const data = await medicalRecordService.getAll(user.uid);
      console.log('Registros cargados:', data);
      console.log('Número de registros:', data.length);
      
      setRecords(data);
      console.log('=== FIN loadRecords ===');
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
    if (!user?.uid) {
      alert('❌ No se pudo obtener la información del usuario.');
      return;
    }

    if (window.confirm(`¿Estás seguro de que quieres eliminar el registro de ${record.patientName} ${record.patientSurname}?`)) {
      try {
        await medicalRecordService.softDelete(record.id!, user.uid);
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

  const openInvoiceGenerator = (record: MedicalRecord) => {
    setSelectedRecord(record);
    setShowInvoiceGenerator(true);
  };

  const closeInvoiceGenerator = () => {
    setShowInvoiceGenerator(false);
    setSelectedRecord(null);
  };

  const handleInvoiceCreated = () => {
    loadRecords(); // Recargar la lista para mostrar el estado actualizado
  };

  const toggleInvoiceStatus = async (record: MedicalRecord) => {
    if (!user?.uid) {
      alert('❌ No se pudo obtener la información del usuario.');
      return;
    }

    try {
      const newStatus = !record.invoiceIssued;
      await medicalRecordService.update(record.id!, { invoiceIssued: newStatus });
      alert(`✅ Estado de facturación actualizado: ${newStatus ? 'Facturado' : 'Sin facturar'}`);
      loadRecords(); // Recargar la lista
    } catch (error) {
      console.error('Error actualizando estado de facturación:', error);
      alert('❌ Error al actualizar el estado de facturación.');
    }
  };

  const togglePaymentStatus = async (record: MedicalRecord) => {
    if (!user?.uid) {
      alert('❌ No se pudo obtener la información del usuario.');
      return;
    }

    try {
      const newStatus = !record.paid;
      await medicalRecordService.update(record.id!, { paid: newStatus });
      alert(`✅ Estado de pago actualizado: ${newStatus ? 'Pagado' : 'Pendiente'}`);
      loadRecords(); // Recargar la lista
    } catch (error) {
      console.error('Error actualizando estado de pago:', error);
      alert('❌ Error al actualizar el estado de pago.');
    }
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



  const deleteAllRecords = async () => {
    if (!isAdmin) {
      alert('❌ Solo los administradores pueden realizar esta acción.');
      return;
    }

    try {
      setDeletingAll(true);
      const result = await medicalRecordService.deleteAllRecords();
      alert(`✅ ${result.message}`);
      setShowDeleteAllModal(false);
      loadRecords(); // Recargar la lista
    } catch (error) {
      console.error('Error eliminando todos los registros:', error);
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setDeletingAll(false);
    }
  };

  const renderReportTypeLogo = (reportType: string) => {
    return (
      <span className="text-xs bg-pastel-blue text-primary-700 px-2 py-1 rounded-lg">
        {reportType}
      </span>
    );
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
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center justify-center px-4 py-2 border border-white/20 text-sm font-medium rounded-xl text-primary-700 bg-white/90 hover:bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 shadow-gentle hover:shadow-soft"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </button>
              
              <button
                onClick={loadRecords}
                disabled={loading}
                className="inline-flex items-center justify-center px-4 py-2 border border-white/20 text-sm font-medium rounded-xl text-primary-700 bg-white/90 hover:bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 shadow-gentle hover:shadow-soft disabled:opacity-50"
                title="Recargar registros"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Recargar
              </button>

              {/* Botón de administración - Solo visible para administradores */}
              {isAdmin && (
                <button
                  onClick={() => setShowDeleteAllModal(true)}
                  className="inline-flex items-center justify-center px-4 py-2 border border-white/20 text-sm font-medium rounded-xl text-red-600 bg-white/90 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 shadow-gentle hover:shadow-soft"
                  title="Eliminar todo el historial (Solo administradores)"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Borrar Todo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filtros */}
        {showFilters && (
          <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-pastel-gray-light bg-pastel-gray-light">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">Nombre</label>
                <input
                  type="text"
                  value={filters.name || ''}
                  onChange={(e) => handleFilterChange('name', e.target.value || undefined)}
                  className="w-full px-3 sm:px-4 py-2 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="Buscar por nombre..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">Apellidos</label>
                <input
                  type="text"
                  value={filters.surname || ''}
                  onChange={(e) => handleFilterChange('surname', e.target.value || undefined)}
                  className="w-full px-3 sm:px-4 py-2 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="Buscar por apellidos..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">DNI</label>
                <input
                  type="text"
                  value={filters.dni || ''}
                  onChange={(e) => handleFilterChange('dni', e.target.value || undefined)}
                  className="w-full px-3 sm:px-4 py-2 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="Buscar por DNI..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">Palabras clave</label>
                <input
                  type="text"
                  value={filters.keywords || ''}
                  onChange={(e) => handleFilterChange('keywords', e.target.value || undefined)}
                  className="w-full px-3 sm:px-4 py-2 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="Buscar en el informe..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">Fecha desde</label>
                <input
                  type="date"
                  value={filters.dateFrom ? filters.dateFrom.toISOString().split('T')[0] : ''}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value ? new Date(e.target.value) : undefined)}
                  className="w-full px-3 sm:px-4 py-2 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">Fecha hasta</label>
                <input
                  type="date"
                  value={filters.dateTo ? filters.dateTo.toISOString().split('T')[0] : ''}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value ? new Date(e.target.value) : undefined)}
                  className="w-full px-3 sm:px-4 py-2 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
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
                  className="w-full px-3 sm:px-4 py-2 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
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
                  className="w-full px-3 sm:px-4 py-2 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
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
                          {renderReportTypeLogo(record.reportType)}
                        </div>
                        {/* Estado de facturación - versión clickeable */}
                        <div className="flex items-center space-x-2">
                          {record.invoiceIssued !== undefined && (
                            <button
                              onClick={() => toggleInvoiceStatus(record)}
                              className="flex items-center space-x-1 hover:scale-105 transition-transform duration-200"
                              title={`Hacer clic para cambiar a: ${record.invoiceIssued ? 'Sin facturar' : 'Facturado'}`}
                            >
                              <Receipt className="h-3 w-3 text-gray-500" />
                              <span className={`text-xs px-1.5 py-0.5 rounded-md cursor-pointer ${
                                record.invoiceIssued 
                                  ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200' 
                                  : 'bg-yellow-100 text-yellow-700 border border-yellow-200 hover:bg-yellow-200'
                              }`}>
                                {record.invoiceIssued ? 'Facturado' : 'Sin facturar'}
                              </span>
                            </button>
                          )}
                          {record.paid !== undefined && (
                            <button
                              onClick={() => togglePaymentStatus(record)}
                              className="flex items-center space-x-1 hover:scale-105 transition-transform duration-200"
                              title={`Hacer clic para cambiar a: ${record.paid ? 'Pendiente' : 'Pagado'}`}
                            >
                              <CreditCard className="h-3 w-3 text-gray-500" />
                              <span className={`text-xs px-1.5 py-0.5 rounded-md cursor-pointer ${
                                record.paid 
                                  ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200' 
                                  : 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200'
                              }`}>
                                {record.paid ? 'Pagado' : 'Pendiente'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-sm text-pastel-gray-dark line-clamp-2 leading-relaxed">
                        {record.report.substring(0, 200)}...
                      </p>
                      
                      {/* Documentos adjuntos */}
                      {record.uploadedDocuments && record.uploadedDocuments.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-pastel-gray-light">
                          <div className="flex items-center space-x-2 mb-2">
                            <Paperclip className="h-4 w-4 text-primary-600" />
                            <span className="text-sm font-medium text-primary-700">
                              Documentos adjuntos ({record.uploadedDocuments.length})
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {record.uploadedDocuments.map((url, index) => {
                              const fileName = url.split('/').pop() || `Documento ${index + 1}`;
                              return (
                                <a
                                  key={index}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center space-x-1 px-3 py-1.5 bg-pastel-gray-light hover:bg-pastel-blue rounded-lg text-sm text-primary-700 transition-all duration-200"
                                >
                                  <FileText className="h-3 w-3" />
                                  <span className="max-w-[150px] truncate">{fileName}</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 ml-4 sm:ml-6">
                      <button
                        onClick={() => viewRecord(record)}
                        className="inline-flex items-center justify-center px-3 py-2 border border-primary-300 text-sm font-medium rounded-xl text-primary-700 bg-white hover:bg-pastel-gray-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
                        title="Ver detalles"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      
                      <button
                        onClick={() => editRecord(record)}
                        className="inline-flex items-center justify-center px-3 py-2 border border-yellow-300 text-sm font-medium rounded-xl text-yellow-700 bg-white hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-all duration-200"
                        title="Editar registro"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      
                      <button
                        onClick={() => downloadPDF(record)}
                        className="inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
                        title="Descargar PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      
                      <button
                        onClick={() => sendProtectedEmail(record)}
                        disabled={sendingEmail === record.id}
                        className="inline-flex items-center justify-center px-3 py-2 border border-green-300 text-sm font-medium rounded-xl text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Enviar por email con enlace de descarga"
                      >
                        {sendingEmail === record.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                      </button>
                      
                      {/* Botón de facturación */}
                      <button
                        onClick={() => openInvoiceGenerator(record)}
                        disabled={record.invoiceIssued}
                        className={`inline-flex items-center justify-center px-3 py-2 border text-sm font-medium rounded-xl transition-all duration-200 ${
                          record.invoiceIssued
                            ? 'border-green-300 text-green-700 bg-green-50 cursor-not-allowed'
                            : 'border-primary-300 text-primary-700 bg-white hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
                        }`}
                        title={record.invoiceIssued ? 'Factura ya emitida' : 'Generar factura profesional'}
                      >
                        <Receipt className="h-4 w-4" />
                      </button>
                      
                      <button
                        onClick={() => deleteRecord(record)}
                        className="inline-flex items-center justify-center px-3 py-2 border border-red-300 text-sm font-medium rounded-xl text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200"
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

      {/* Modal de confirmación para borrar todo */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">⚠️ Confirmar Eliminación</h3>
                <p className="text-sm text-gray-600">Acción irreversible</p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                ¿Estás seguro de que quieres eliminar <strong>TODOS</strong> los registros del historial?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-700 font-medium">
                  ⚠️ Esta acción es <strong>IRREVERSIBLE</strong> y eliminará permanentemente:
                </p>
                <ul className="text-sm text-red-600 mt-2 space-y-1">
                  <li>• Todos los registros médicos</li>
                  <li>• Todos los archivos subidos</li>
                  <li>• Todo el historial de la aplicación</li>
                </ul>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <button
                onClick={() => setShowDeleteAllModal(false)}
                className="flex-1 px-4 py-3 border border-gray-300 text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200"
              >
                Cancelar
              </button>
              <button
                onClick={deleteAllRecords}
                disabled={deletingAll}
                className="flex-1 px-4 py-3 border border-transparent text-sm font-medium rounded-xl text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingAll ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Eliminando...
                  </div>
                ) : (
                  'Eliminar Todo'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de generador de facturas */}
      {showInvoiceGenerator && selectedRecord && (
        <InvoiceGenerator
          medicalRecord={selectedRecord}
          onClose={closeInvoiceGenerator}
          onInvoiceCreated={handleInvoiceCreated}
        />
      )}
    </div>
  );
};

export default RecordHistory; 