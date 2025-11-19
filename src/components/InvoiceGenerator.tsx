import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '../contexts/UserContext';
import { invoiceService } from '../services/invoiceService';
import { MedicalRecord, CompanyInfo, InvoiceItem } from '../types';
import {
  Receipt,
  FileText,
  Euro,
  Plus,
  Trash2,
  Save,
  X,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

interface InvoiceGeneratorProps {
  medicalRecord: MedicalRecord;
  onClose: () => void;
  onInvoiceCreated: () => void;
}

const InvoiceGenerator: React.FC<InvoiceGeneratorProps> = ({
  medicalRecord,
  onClose,
  onInvoiceCreated,
}) => {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');

  // Información de la empresa
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    userId: user?.uid || '',
    companyName: '',
    taxId: '',
    address: '',
    city: '',
    postalCode: '',
    province: '',
    country: 'ES',
    phone: '',
    email: user?.email || '',
    website: '',
    logoUrl: '',
    bankAccount: '',
    bankName: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Items de la factura
  const [items, setItems] = useState<
    Omit<InvoiceItem, 'id' | 'subtotal' | 'taxAmount' | 'total'>[]
  >([
    {
      description: `Informe médico ${medicalRecord.reportType}`,
      quantity: 1,
      unitPrice: 90.0,
      discount: 0,
      taxRate: 0.0,
    },
  ]);

  // Validación
  const [validationErrors, setValidationErrors] = useState<{
    [key: string]: string;
  }>({});

  const [draftSaved, setDraftSaved] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const loadCompanyInfo = useCallback(async () => {
    try {
      // Aquí se cargaría la información de la empresa desde Firestore
      // Por ahora usamos valores por defecto
      if (user?.email) {
        setCompanyInfo(prev => ({
          ...prev,
          email: user.email || '',
        }));
      }
    } catch (error) {
      console.error('Error cargando información de la empresa:', error);
    }
  }, [user?.email]);

  // Cargar borrador al iniciar
  const loadDraft = useCallback(async () => {
    if (!user?.uid || !medicalRecord.id) {
      setIsLoadingDraft(false);
      return;
    }

    try {
      setIsLoadingDraft(true);
      const draft = await invoiceService.loadDraft(user.uid, medicalRecord.id);
      if (draft) {
        setCompanyInfo(draft.companyInfo);
        setItems(draft.items);
        setIsPaid(draft.isPaid || false);
        setPaymentMethod(draft.paymentMethod || '');
        setDraftSaved(true);
      }
      setIsLoadingDraft(false);
    } catch (error) {
      console.error('Error cargando borrador:', error);
      setIsLoadingDraft(false);
    }
  }, [user?.uid, medicalRecord.id]);

  // Guardar borrador automáticamente con debounce
  const saveDraft = useCallback(async () => {
    if (!user?.uid || !medicalRecord.id) return;

    // Limpiar timeout anterior
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Guardar después de 1 segundo de inactividad
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setSavingDraft(true);
        await invoiceService.saveDraft(
          user.uid,
          medicalRecord.id!,
          companyInfo,
          items,
          {
            isPaid,
            paymentMethod: isPaid ? paymentMethod : undefined,
          }
        );
        setDraftSaved(true);
      } catch (error) {
        console.error('Error guardando borrador:', error);
      } finally {
        setSavingDraft(false);
      }
    }, 1000);
  }, [user?.uid, medicalRecord.id, companyInfo, items, isPaid, paymentMethod]);

  useEffect(() => {
    loadCompanyInfo();
    loadDraft();
  }, [loadCompanyInfo, loadDraft]);

  // Guardar automáticamente cuando cambien los datos
  useEffect(() => {
    // No guardar si está cargando el borrador inicial
    if (isLoadingDraft) return;

    // No guardar si no hay usuario o registro médico
    if (!user?.uid || !medicalRecord.id) return;

    saveDraft();

    // Limpiar timeout al desmontar
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    companyInfo,
    items,
    saveDraft,
    isLoadingDraft,
    user?.uid,
    medicalRecord.id,
  ]);

  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    // Validar información de la empresa
    if (!companyInfo.companyName.trim()) {
      errors.companyName = 'El nombre de la empresa es obligatorio';
    }
    if (!companyInfo.taxId.trim()) {
      errors.taxId = 'El NIF/CIF es obligatorio';
    }
    if (!companyInfo.address.trim()) {
      errors.address = 'La dirección es obligatoria';
    }
    if (!companyInfo.city.trim()) {
      errors.city = 'La ciudad es obligatoria';
    }
    if (!companyInfo.postalCode.trim()) {
      errors.postalCode = 'El código postal es obligatorio';
    }
    if (!companyInfo.province.trim()) {
      errors.province = 'La provincia es obligatoria';
    }
    if (!companyInfo.phone.trim()) {
      errors.phone = 'El teléfono es obligatorio';
    }
    if (!companyInfo.email.trim()) {
      errors.email = 'El email es obligatorio';
    }

    // Validar items
    if (items.length === 0) {
      errors.items = 'Debe haber al menos un item en la factura';
    }

    items.forEach((item, index) => {
      if (!item.description.trim()) {
        errors[`item${index}Description`] = 'La descripción es obligatoria';
      }
      if (item.quantity <= 0) {
        errors[`item${index}Quantity`] = 'La cantidad debe ser mayor a 0';
      }
      if (item.unitPrice <= 0) {
        errors[`item${index}UnitPrice`] =
          'El precio unitario debe ser mayor a 0';
      }
      if (item.taxRate < 0 || item.taxRate > 100) {
        errors[`item${index}TaxRate`] =
          'El tipo de IVA debe estar entre 0 y 100';
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCompanyInfoChange = (field: keyof CompanyInfo, value: string) => {
    setCompanyInfo(prev => ({
      ...prev,
      [field]: value,
    }));

    // Limpiar error de validación
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleItemChange = (
    index: number,
    field: keyof InvoiceItem,
    value: string | number
  ) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]:
        field === 'quantity' ||
        field === 'unitPrice' ||
        field === 'discount' ||
        field === 'taxRate'
          ? parseFloat(value as string) || 0
          : value,
    };
    setItems(newItems);

    // Limpiar error de validación
    const errorKey = `item${index}${
      field.charAt(0).toUpperCase() + field.slice(1)
    }`;
    if (validationErrors[errorKey]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        description: '',
        quantity: 1,
        unitPrice: 90.0,
        discount: 0,
        taxRate: 0.0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const createInvoice = async () => {
    if (!validateForm()) {
      return;
    }

    if (!user?.uid) {
      setError('No se pudo obtener la información del usuario');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // Crear la factura
      const invoice = await invoiceService.createInvoice(
        user.uid,
        medicalRecord,
        companyInfo,
        items,
        {
          isPaid,
          paymentMethod: isPaid ? paymentMethod : undefined,
        }
      );

      setSuccess(`✅ Factura ${invoice.invoiceNumber} creada exitosamente`);

      // Eliminar borrador después de crear la factura
      if (user?.uid && medicalRecord.id) {
        await invoiceService.deleteDraft(user.uid, medicalRecord.id);
      }

      // Notificar al componente padre
      setTimeout(() => {
        onInvoiceCreated();
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error creando factura:', error);
      setError(
        `❌ Error al crear la factura: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const calculateItemTotals = (
    item: Omit<InvoiceItem, 'id' | 'subtotal' | 'taxAmount' | 'total'>
  ) => {
    const subtotal =
      item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
    const taxAmount = subtotal * (item.taxRate / 100);
    const total = subtotal + taxAmount;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  };

  const calculateInvoiceTotals = () => {
    return items.reduce(
      (totals, item) => {
        const itemTotals = calculateItemTotals(item);
        return {
          subtotal: totals.subtotal + itemTotals.subtotal,
          taxAmount: totals.taxAmount + itemTotals.taxAmount,
          total: totals.total + itemTotals.total,
        };
      },
      { subtotal: 0, taxAmount: 0, total: 0 }
    );
  };

  const invoiceTotals = calculateInvoiceTotals();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-pastel-blue to-pastel-blue-light px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-gentle">
                <Receipt className="h-5 w-5 text-primary-700" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-primary-700">
                  Generar Factura
                </h2>
                <p className="text-primary-600 text-sm">
                  Paciente: {medicalRecord.patientName}{' '}
                  {medicalRecord.patientSurname}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {savingDraft && (
                <div className="flex items-center space-x-2 text-primary-600 text-sm">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                  <span>Guardando...</span>
                </div>
              )}
              {draftSaved && !savingDraft && (
                <div className="flex items-center space-x-2 text-green-600 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  <span>Borrador guardado</span>
                </div>
              )}
              <button
                onClick={onClose}
                className="text-primary-700 hover:text-primary-800 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Mensajes de estado */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-700">{success}</span>
            </div>
          )}

          {/* Información de la empresa */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-primary-700 mb-4 flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Información de la Empresa</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Nombre de la empresa *
                </label>
                <input
                  type="text"
                  value={companyInfo.companyName}
                  onChange={e =>
                    handleCompanyInfoChange('companyName', e.target.value)
                  }
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 ${
                    validationErrors.companyName
                      ? 'border-red-300'
                      : 'border-pastel-gray-light'
                  }`}
                  placeholder="Nombre de la empresa"
                />
                {validationErrors.companyName && (
                  <p className="text-red-600 text-sm mt-1">
                    {validationErrors.companyName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  NIF/CIF *
                </label>
                <input
                  type="text"
                  value={companyInfo.taxId}
                  onChange={e =>
                    handleCompanyInfoChange('taxId', e.target.value)
                  }
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 ${
                    validationErrors.taxId
                      ? 'border-red-300'
                      : 'border-pastel-gray-light'
                  }`}
                  placeholder="NIF/CIF"
                />
                {validationErrors.taxId && (
                  <p className="text-red-600 text-sm mt-1">
                    {validationErrors.taxId}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Dirección *
                </label>
                <input
                  type="text"
                  value={companyInfo.address}
                  onChange={e =>
                    handleCompanyInfoChange('address', e.target.value)
                  }
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 ${
                    validationErrors.address
                      ? 'border-red-300'
                      : 'border-pastel-gray-light'
                  }`}
                  placeholder="Dirección completa"
                />
                {validationErrors.address && (
                  <p className="text-red-600 text-sm mt-1">
                    {validationErrors.address}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Ciudad *
                </label>
                <input
                  type="text"
                  value={companyInfo.city}
                  onChange={e =>
                    handleCompanyInfoChange('city', e.target.value)
                  }
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 ${
                    validationErrors.city
                      ? 'border-red-300'
                      : 'border-pastel-gray-light'
                  }`}
                  placeholder="Ciudad"
                />
                {validationErrors.city && (
                  <p className="text-red-600 text-sm mt-1">
                    {validationErrors.city}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Código Postal *
                </label>
                <input
                  type="text"
                  value={companyInfo.postalCode}
                  onChange={e =>
                    handleCompanyInfoChange('postalCode', e.target.value)
                  }
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 ${
                    validationErrors.postalCode
                      ? 'border-red-300'
                      : 'border-pastel-gray-light'
                  }`}
                  placeholder="Código postal"
                />
                {validationErrors.postalCode && (
                  <p className="text-red-600 text-sm mt-1">
                    {validationErrors.postalCode}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Provincia *
                </label>
                <input
                  type="text"
                  value={companyInfo.province}
                  onChange={e =>
                    handleCompanyInfoChange('province', e.target.value)
                  }
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 ${
                    validationErrors.province
                      ? 'border-red-300'
                      : 'border-pastel-gray-light'
                  }`}
                  placeholder="Provincia"
                />
                {validationErrors.province && (
                  <p className="text-red-600 text-sm mt-1">
                    {validationErrors.province}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Teléfono *
                </label>
                <input
                  type="tel"
                  value={companyInfo.phone}
                  onChange={e =>
                    handleCompanyInfoChange('phone', e.target.value)
                  }
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 ${
                    validationErrors.phone
                      ? 'border-red-300'
                      : 'border-pastel-gray-light'
                  }`}
                  placeholder="Teléfono"
                />
                {validationErrors.phone && (
                  <p className="text-red-600 text-sm mt-1">
                    {validationErrors.phone}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={companyInfo.email}
                  onChange={e =>
                    handleCompanyInfoChange('email', e.target.value)
                  }
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 ${
                    validationErrors.email
                      ? 'border-red-300'
                      : 'border-pastel-gray-light'
                  }`}
                  placeholder="Email"
                />
                {validationErrors.email && (
                  <p className="text-red-600 text-sm mt-1">
                    {validationErrors.email}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Items de la factura */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-primary-700 flex items-center space-x-2">
                <Euro className="h-5 w-5" />
                <span>Items de la Factura</span>
              </h3>
              <button
                onClick={addItem}
                className="inline-flex items-center px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                Añadir Item
              </button>
            </div>

            {items.map((item, index) => (
              <div
                key={index}
                className="border border-pastel-gray-light rounded-xl p-4 mb-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-primary-700 mb-2">
                      Descripción *
                    </label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={e =>
                        handleItemChange(index, 'description', e.target.value)
                      }
                      className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 ${
                        validationErrors[`item${index}Description`]
                          ? 'border-red-300'
                          : 'border-pastel-gray-light'
                      }`}
                      placeholder="Descripción del servicio"
                    />
                    {validationErrors[`item${index}Description`] && (
                      <p className="text-red-600 text-sm mt-1">
                        {validationErrors[`item${index}Description`]}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary-700 mb-2">
                      Cantidad *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={e =>
                        handleItemChange(index, 'quantity', e.target.value)
                      }
                      className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 ${
                        validationErrors[`item${index}Quantity`]
                          ? 'border-red-300'
                          : 'border-pastel-gray-light'
                      }`}
                    />
                    {validationErrors[`item${index}Quantity`] && (
                      <p className="text-red-600 text-sm mt-1">
                        {validationErrors[`item${index}Quantity`]}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary-700 mb-2">
                      Precio Unit. *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={e =>
                        handleItemChange(index, 'unitPrice', e.target.value)
                      }
                      className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 ${
                        validationErrors[`item${index}UnitPrice`]
                          ? 'border-red-300'
                          : 'border-pastel-gray-light'
                      }`}
                    />
                    {validationErrors[`item${index}UnitPrice`] && (
                      <p className="text-red-600 text-sm mt-1">
                        {validationErrors[`item${index}UnitPrice`]}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary-700 mb-2">
                      IVA (%) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={item.taxRate}
                      onChange={e =>
                        handleItemChange(index, 'taxRate', e.target.value)
                      }
                      className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 ${
                        validationErrors[`item${index}TaxRate`]
                          ? 'border-red-300'
                          : 'border-pastel-gray-light'
                      }`}
                    />
                    {validationErrors[`item${index}TaxRate`] && (
                      <p className="text-red-600 text-sm mt-1">
                        {validationErrors[`item${index}TaxRate`]}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="text-sm text-pastel-gray-dark">
                      <div>
                        Subtotal:{' '}
                        {calculateItemTotals(item).subtotal.toFixed(2)}€
                      </div>
                      <div>
                        Total: {calculateItemTotals(item).total.toFixed(2)}€
                      </div>
                    </div>
                    {items.length > 1 && (
                      <button
                        onClick={() => removeItem(index)}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200"
                        title="Eliminar item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {validationErrors.items && (
              <p className="text-red-600 text-sm mt-2">
                {validationErrors.items}
              </p>
            )}
          </div>

          {/* Totales */}
          <div className="bg-pastel-gray-light rounded-xl p-6 mb-8">
            <h3 className="text-lg font-semibold text-primary-700 mb-4">
              Resumen de la Factura
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-sm text-pastel-gray-dark">Subtotal</p>
                <p className="text-2xl font-bold text-primary-700">
                  {invoiceTotals.subtotal.toFixed(2)}€
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-pastel-gray-dark">Total</p>
                <p className="text-3xl font-bold text-primary-700">
                  {invoiceTotals.total.toFixed(2)}€
                </p>
              </div>
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm text-pastel-gray-dark">
                <strong>Asistencia sanitaria exenta de IVA</strong> según Art.
                20.1.9º Ley 37/1992
              </p>
            </div>
          </div>

          {/* Información legal */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-blue-900 mb-2">
                  Cumplimiento Legal
                </h4>
                <p className="text-sm text-blue-700 mb-2">
                  Esta factura se generará cumpliendo rigurosamente con el{' '}
                  <strong>Real Decreto 1007/2023</strong>
                  (Reglamento Verifactu) que establece el marco regulador de los
                  Sistemas Informáticos de Facturación (SIF).
                </p>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Formato XML Facturae estándar español</li>
                  <li>• Trazabilidad completa según SIF</li>
                  <li>• Auditoría automática de todas las operaciones</li>
                  <li>• Cumplimiento con la normativa tributaria vigente</li>
                  <li>
                    • <strong>Asistencia sanitaria exenta de IVA</strong> según
                    Art. 20.1.9º Ley 37/1992
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Opciones de pago */}
          <div className="bg-pastel-gray-light rounded-xl p-6 mb-8">
            <h3 className="text-lg font-semibold text-primary-700 mb-4">
              Estado de Pago
            </h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="isPaid"
                  checked={isPaid}
                  onChange={e => setIsPaid(e.target.checked)}
                  className="w-5 h-5 text-primary-600 border-pastel-gray-light rounded focus:ring-primary-500 focus:ring-2"
                />
                <label
                  htmlFor="isPaid"
                  className="text-sm font-medium text-primary-700 cursor-pointer"
                >
                  Factura ya pagada
                </label>
              </div>
              {isPaid && (
                <div>
                  <label className="block text-sm font-medium text-primary-700 mb-2">
                    Método de pago
                  </label>
                  <input
                    type="text"
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-pastel-gray-light rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                    placeholder="Ej: Efectivo, Transferencia, Tarjeta..."
                  />
                </div>
              )}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-3 border border-pastel-gray-light text-primary-700 bg-white hover:bg-pastel-gray-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 rounded-xl font-medium"
            >
              Cancelar
            </button>

            <button
              onClick={createInvoice}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generando factura...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Generar Factura
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceGenerator;
