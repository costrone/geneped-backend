import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { invoiceService } from '../services/invoiceService';
import { Invoice } from '../types';
import { Receipt, Download, FileText, Eye, Euro, Calendar, User, Search, Filter, RefreshCw, AlertCircle, CheckCircle, Clock, CreditCard, Shield } from 'lucide-react';
import InvoiceIntegrityChecker from './InvoiceIntegrityChecker';

const InvoiceManager: React.FC = () => {
  const { user } = useUser();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    dateFrom: '',
    dateTo: '',
    patientName: '',
    invoiceNumber: ''
  });
  const [showIntegrityChecker, setShowIntegrityChecker] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    if (user) {
      loadInvoices();
    }
  }, [user]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (!user?.uid) {
        setError('No se pudo obtener la información del usuario.');
        return;
      }
      
      const data = await invoiceService.getUserInvoices(user.uid);
      setInvoices(data);
      setFilteredInvoices(data);
    } catch (error) {
      console.error('Error cargando facturas:', error);
      setError(`Error al cargar las facturas: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const applyFilters = () => {
    let filtered = [...invoices];

    if (filters.status) {
      filtered = filtered.filter(invoice => invoice.status === filters.status);
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(invoice => 
        new Date(invoice.invoiceDate) >= new Date(filters.dateFrom)
      );
    }

    if (filters.dateTo) {
      filtered = filtered.filter(invoice => 
        new Date(invoice.invoiceDate) <= new Date(filters.dateTo)
      );
    }

    if (filters.patientName) {
      filtered = filtered.filter(invoice =>
        `${invoice.patientInfo.name} ${invoice.patientInfo.surname}`
          .toLowerCase()
          .includes(filters.patientName.toLowerCase())
      );
    }

    if (filters.invoiceNumber) {
      filtered = filtered.filter(invoice =>
        invoice.invoiceNumber.toLowerCase().includes(filters.invoiceNumber.toLowerCase())
      );
    }

    // Ordenar por fecha de creación (más reciente primero)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setFilteredInvoices(filtered);
  };

  useEffect(() => {
    applyFilters();
  }, [filters, invoices]);

  const clearFilters = () => {
    setFilters({
      status: '',
      dateFrom: '',
      dateTo: '',
      patientName: '',
      invoiceNumber: ''
    });
  };

  const downloadInvoicePDF = async (invoice: Invoice) => {
    try {
      const pdfBlob = await invoiceService.generateInvoicePDF(invoice);
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `factura-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error descargando PDF:', error);
      alert('❌ Error al descargar el PDF de la factura.');
    }
  };

  const exportForAEAT = async (invoice: Invoice) => {
    try {
      const xml = await invoiceService.exportInvoiceForAEAT(invoice.id!);
      
      // Crear y descargar archivo XML
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `factura-${invoice.invoiceNumber}-aeat.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      alert('✅ Factura exportada para la AEAT exitosamente');
    } catch (error) {
      console.error('Error exportando para AEAT:', error);
      alert('❌ Error al exportar la factura para la AEAT.');
    }
  };

  const openIntegrityChecker = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowIntegrityChecker(true);
  };

  const closeIntegrityChecker = () => {
    setShowIntegrityChecker(false);
    setSelectedInvoice(null);
  };

  const getStatusBadge = (status: Invoice['status']) => {
    const statusConfig = {
      draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-700 border-gray-200' },
      sent: { label: 'Enviada', color: 'bg-blue-100 text-blue-700 border-blue-200' },
      paid: { label: 'Pagada', color: 'bg-green-100 text-green-700 border-green-200' },
      overdue: { label: 'Vencida', color: 'bg-red-100 text-red-700 border-red-200' },
      cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700 border-red-200' }
    };

    const config = statusConfig[status];
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
        {config.label}
      </span>
    );
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="text-pastel-gray-dark">Cargando facturas...</p>
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
                <Receipt className="h-6 w-6 text-primary-700" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-primary-700">Gestor de Facturas</h2>
                <p className="text-primary-600 text-sm">
                  {filteredInvoices.length} facturas encontradas
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center justify-center px-4 py-2 border border-white/20 text-sm font-medium rounded-xl text-primary-700 bg-white/90 hover:bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 shadow-gentle hover:shadow-soft"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </button>
              
              <button
                onClick={loadInvoices}
                disabled={loading}
                className="inline-flex items-center justify-center px-4 py-2 border border-white/20 text-sm font-medium rounded-xl text-primary-700 bg-white/90 hover:bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 shadow-gentle hover:shadow-soft disabled:opacity-50"
                title="Recargar facturas"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Recargar
              </button>
            </div>
          </div>
        </div>

        {/* Filtros */}
        {showFilters && (
          <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-pastel-gray-light bg-pastel-gray-light">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">Estado</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                >
                  <option value="">Todos</option>
                  <option value="draft">Borrador</option>
                  <option value="sent">Enviada</option>
                  <option value="paid">Pagada</option>
                  <option value="overdue">Vencida</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">Fecha desde</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">Fecha hasta</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">Paciente</label>
                <input
                  type="text"
                  value={filters.patientName}
                  onChange={(e) => handleFilterChange('patientName', e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="Buscar por paciente..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">Número</label>
                <input
                  type="text"
                  value={filters.invoiceNumber}
                  onChange={(e) => handleFilterChange('invoiceNumber', e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="Buscar por número..."
                />
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

        {/* Lista de facturas */}
        <div className="overflow-hidden">
          {error && (
            <div className="px-8 py-4 text-red-600 bg-red-50 border-b border-red-200">
              {error}
            </div>
          )}

          {filteredInvoices.length === 0 ? (
            <div className="px-8 py-12 text-center">
              <Receipt className="mx-auto h-12 w-12 text-pastel-gray-dark" />
              <h3 className="mt-2 text-sm font-medium text-primary-700">No se encontraron facturas</h3>
              <p className="mt-1 text-sm text-pastel-gray-dark">
                {invoices.length === 0 ? 'No hay facturas emitidas.' : 'Intenta ajustar los filtros de búsqueda.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-pastel-gray-light">
              {filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="px-8 py-6 hover:bg-pastel-gray-light transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-pastel-blue to-pastel-blue-light rounded-lg flex items-center justify-center">
                          <Receipt className="h-5 w-5 text-primary-700" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-primary-700">
                            Factura {invoice.invoiceNumber}
                          </h3>
                          <p className="text-sm text-pastel-gray-dark">
                            {invoice.patientInfo.name} {invoice.patientInfo.surname}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-pastel-gray-dark mb-3">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(invoice.invoiceDate)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <User className="h-4 w-4" />
                          <span>DNI: {invoice.patientInfo.dni}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Euro className="h-4 w-4" />
                          <span>{invoice.total.toFixed(2)}€</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          {getStatusBadge(invoice.status)}
                        </div>
                      </div>
                      
                      <div className="text-sm text-pastel-gray-dark">
                        <p><strong>Empresa:</strong> {invoice.companyInfo.companyName}</p>
                        <p><strong>Items:</strong> {invoice.items.length} servicio(s)</p>
                        {invoice.notes && <p><strong>Notas:</strong> {invoice.notes}</p>}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 ml-4 sm:ml-6">
                      <button
                        onClick={() => downloadInvoicePDF(invoice)}
                        className="inline-flex items-center justify-center px-3 py-2 border border-primary-300 text-sm font-medium rounded-xl text-primary-700 bg-white hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
                        title="Descargar PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      
                      <button
                        onClick={() => exportForAEAT(invoice)}
                        className="inline-flex items-center justify-center px-3 py-2 border border-green-300 text-sm font-medium rounded-xl text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200"
                        title="Exportar para AEAT (XML Facturae)"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                      
                      <button
                        onClick={() => openIntegrityChecker(invoice)}
                        className="inline-flex items-center justify-center px-3 py-2 border border-blue-300 text-sm font-medium rounded-xl text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                        title="Verificar integridad Verifactu"
                      >
                        <Shield className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de verificación de integridad */}
      {showIntegrityChecker && selectedInvoice && (
        <InvoiceIntegrityChecker
          invoice={selectedInvoice}
          onClose={closeIntegrityChecker}
        />
      )}
    </div>
  );
};

export default InvoiceManager;
