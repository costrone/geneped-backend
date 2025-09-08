import React, { useState } from 'react';
import { Invoice, AuditLog } from '../types';
import { cryptoService } from '../services/cryptoService';
import { Shield, CheckCircle, AlertTriangle, FileText, Hash, Lock, Unlock } from 'lucide-react';

interface InvoiceIntegrityCheckerProps {
  invoice: Invoice;
  onClose: () => void;
}

const InvoiceIntegrityChecker: React.FC<InvoiceIntegrityCheckerProps> = ({ invoice, onClose }) => {
  const [verifying, setVerifying] = useState(false);
  const [verificationResults, setVerificationResults] = useState<{
    invoiceIntegrity: boolean;
    auditTrailIntegrity: boolean;
    chainIntegrity: boolean;
    details: string[];
  } | null>(null);

  const verifyIntegrity = async () => {
    setVerifying(true);
    setVerificationResults(null);

    try {
      const results = {
        invoiceIntegrity: false,
        auditTrailIntegrity: false,
        chainIntegrity: false,
        details: [] as string[]
      };

      // 1. Verificar integridad de la factura
      const expectedInvoiceHash = await cryptoService.generateInvoiceHash(invoice);
      const actualInvoiceHash = invoice.auditTrail.find(log => log.action === 'created')?.hash || '';
      
      if (expectedInvoiceHash === actualInvoiceHash) {
        results.invoiceIntegrity = true;
        results.details.push('✅ Hash de la factura verificado correctamente');
      } else {
        results.details.push('❌ Hash de la factura no coincide');
      }

      // 2. Verificar integridad de la cadena de auditoría
      let chainValid = true;
      let previousHash = '';
      
      for (let i = 0; i < invoice.auditTrail.length; i++) {
        const event = invoice.auditTrail[i];
        
        if (i === 0) {
          // Primer evento
          if (event.previousHash !== '') {
            chainValid = false;
            results.details.push(`❌ Primer evento no debe tener hash anterior`);
          }
        } else {
          // Eventos subsiguientes
          if (event.previousHash !== previousHash) {
            chainValid = false;
            results.details.push(`❌ Cadena rota en evento ${i + 1}: ${event.action}`);
          }
        }
        
        // Verificar firma del evento
        const eventIntegrity = await cryptoService.verifyEventIntegrity(event);
        if (!eventIntegrity) {
          chainValid = false;
          results.details.push(`❌ Firma del evento ${i + 1} no válida: ${event.action}`);
        }
        
        previousHash = event.hash;
      }
      
      results.chainIntegrity = chainValid;
      if (chainValid) {
        results.details.push('✅ Cadena de auditoría verificada correctamente');
      }

      // 3. Verificar integridad general del sistema
      results.auditTrailIntegrity = results.invoiceIntegrity && results.chainIntegrity;
      
      if (results.auditTrailIntegrity) {
        results.details.push('✅ Sistema de auditoría Verifactu completamente verificado');
      }

      setVerificationResults(results);
    } catch (error) {
      console.error('Error verificando integridad:', error);
      setVerificationResults({
        invoiceIntegrity: false,
        auditTrailIntegrity: false,
        chainIntegrity: false,
        details: ['❌ Error durante la verificación: ' + (error instanceof Error ? error.message : 'Error desconocido')]
      });
    } finally {
      setVerifying(false);
    }
  };

  const getIntegrityStatus = () => {
    if (!verificationResults) return 'pending';
    if (verificationResults.auditTrailIntegrity) return 'valid';
    return 'invalid';
  };

  const getStatusIcon = () => {
    const status = getIntegrityStatus();
    switch (status) {
      case 'valid':
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      case 'invalid':
        return <AlertTriangle className="h-6 w-6 text-red-600" />;
      default:
        return <Shield className="h-6 w-6 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    const status = getIntegrityStatus();
    switch (status) {
      case 'valid':
        return 'Integridad Verificada';
      case 'invalid':
        return 'Problemas de Integridad Detectados';
      default:
        return 'Pendiente de Verificación';
    }
  };

  const getStatusColor = () => {
    const status = getIntegrityStatus();
    switch (status) {
      case 'valid':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'invalid':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-pastel-blue to-pastel-blue-light px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-gentle">
                <Shield className="h-5 w-5 text-primary-700" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-primary-700">Verificador de Integridad Verifactu</h2>
                <p className="text-primary-600 text-sm">
                  Factura: {invoice.invoiceNumber}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-primary-700 hover:text-primary-800 transition-colors"
            >
              <span className="sr-only">Cerrar</span>
              ×
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Estado de integridad */}
          <div className={`mb-6 p-4 border rounded-xl ${getStatusColor()}`}>
            <div className="flex items-center space-x-3">
              {getStatusIcon()}
              <div>
                <h3 className="font-semibold">{getStatusText()}</h3>
                <p className="text-sm opacity-80">
                  Verificación de cumplimiento del Reglamento Verifactu (RD 1007/2023)
                </p>
              </div>
            </div>
          </div>

          {/* Información de la factura */}
          <div className="mb-6 p-4 bg-gray-50 rounded-xl">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Información de la Factura</span>
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p><strong>Número:</strong> {invoice.invoiceNumber}</p>
                <p><strong>Fecha:</strong> {invoice.invoiceDate.toLocaleDateString('es-ES')}</p>
                <p><strong>Total:</strong> {invoice.total.toFixed(2)}€</p>
              </div>
              <div>
                <p><strong>Paciente:</strong> {invoice.patientInfo.name} {invoice.patientInfo.surname}</p>
                <p><strong>Empresa:</strong> {invoice.companyInfo.companyName}</p>
                <p><strong>Eventos:</strong> {invoice.auditTrail.length}</p>
              </div>
            </div>
          </div>

          {/* Botón de verificación */}
          <div className="mb-6 text-center">
            <button
              onClick={verifyIntegrity}
              disabled={verifying}
              className="px-6 py-3 bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mx-auto"
            >
              {verifying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Verificando integridad...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Verificar Integridad Verifactu
                </>
              )}
            </button>
          </div>

          {/* Resultados de verificación */}
          {verificationResults && (
            <div className="space-y-4">
              {/* Resumen de verificación */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-4 rounded-xl border ${
                  verificationResults.invoiceIntegrity 
                    ? 'bg-green-50 border-green-200 text-green-700' 
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                  <div className="flex items-center space-x-2">
                    {verificationResults.invoiceIntegrity ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <AlertTriangle className="h-5 w-5" />
                    )}
                    <span className="font-semibold">Integridad de Factura</span>
                  </div>
                  <p className="text-sm mt-1">
                    {verificationResults.invoiceIntegrity ? 'Verificada' : 'No verificada'}
                  </p>
                </div>

                <div className={`p-4 rounded-xl border ${
                  verificationResults.chainIntegrity 
                    ? 'bg-green-50 border-green-200 text-green-700' 
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                  <div className="flex items-center space-x-2">
                    {verificationResults.chainIntegrity ? (
                      <Lock className="h-5 w-5" />
                    ) : (
                      <Unlock className="h-5 w-5" />
                    )}
                    <span className="font-semibold">Cadena de Auditoría</span>
                  </div>
                  <p className="text-sm mt-1">
                    {verificationResults.chainIntegrity ? 'Intacta' : 'Comprometida'}
                  </p>
                </div>

                <div className={`p-4 rounded-xl border ${
                  verificationResults.auditTrailIntegrity 
                    ? 'bg-green-50 border-green-200 text-green-700' 
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                  <div className="flex items-center space-x-2">
                    {verificationResults.auditTrailIntegrity ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <AlertTriangle className="h-5 w-5" />
                    )}
                    <span className="font-semibold">Sistema Verifactu</span>
                  </div>
                  <p className="text-sm mt-1">
                    {verificationResults.auditTrailIntegrity ? 'Cumple' : 'No cumple'}
                  </p>
                </div>
              </div>

              {/* Detalles de verificación */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                  <Hash className="h-5 w-5" />
                  <span>Detalles de la Verificación</span>
                </h4>
                <div className="space-y-2">
                  {verificationResults.details.map((detail, index) => (
                    <div key={index} className="text-sm">
                      {detail}
                    </div>
                  ))}
                </div>
              </div>

              {/* Información legal */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Cumplimiento Verifactu</h4>
                <p className="text-sm text-blue-700 mb-2">
                  Esta verificación confirma el cumplimiento del <strong>Real Decreto 1007/2023</strong> 
                  (Reglamento Verifactu) en cuanto a:
                </p>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• <strong>Trazabilidad criptográfica</strong> de todas las operaciones</li>
                  <li>• <strong>Encadenamiento hash</strong> para garantizar integridad</li>
                  <li>• <strong>Firma digital</strong> de cada evento de auditoría</li>
                  <li>• <strong>Verificación automática</strong> de la cadena de eventos</li>
                </ul>
              </div>
            </div>
          )}

          {/* Botón de cierre */}
          <div className="mt-6 text-center">
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 rounded-xl font-medium"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceIntegrityChecker;
