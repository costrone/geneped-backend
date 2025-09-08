# Sistema de Facturación - Reglamento Verifactu (RD 1007/2023)

## Descripción General

Este sistema de facturación ha sido diseñado para cumplir rigurosamente con el **Real Decreto 1007/2023** que establece el marco regulador de los Sistemas Informáticos de Facturación (SIF), más conocido como **Reglamento Verifactu**.

## Características Principales

### ✅ Cumplimiento Legal Completo
- **Formato XML Facturae**: Estándar oficial español para facturación electrónica
- **Trazabilidad SIF**: Registro completo de todas las operaciones según el reglamento
- **Auditoría Automática**: Logs de todas las acciones para inspecciones de la AEAT
- **Numeración Secuencial**: Sistema automático de numeración por ejercicio fiscal
- **Validaciones Legales**: Cumplimiento de todos los requisitos tributarios españoles

### 🔧 Funcionalidades Técnicas
- **Generación Automática**: Creación de facturas desde registros médicos
- **Cálculo de Impuestos**: IVA automático según normativa vigente
- **Exportación AEAT**: Formato XML estándar para la Administración
- **Generación PDF**: Facturas en formato imprimible y enviable
- **Gestión de Estados**: Control completo del ciclo de vida de la factura

## Estructura del Sistema

### 1. Tipos de Datos

#### `CompanyInfo`
```typescript
interface CompanyInfo {
  companyName: string;        // Nombre de la empresa
  taxId: string;             // NIF/CIF
  address: string;           // Dirección completa
  city: string;              // Ciudad
  postalCode: string;        // Código postal
  province: string;          // Provincia
  country: string;           // País (ES por defecto)
  phone: string;             // Teléfono
  email: string;             // Email
  // ... campos adicionales
}
```

#### `Invoice`
```typescript
interface Invoice {
  invoiceNumber: string;     // Número secuencial único
  invoiceDate: Date;         // Fecha de emisión
  dueDate: Date;             // Fecha de vencimiento
  patientInfo: PatientInfo;  // Información del paciente
  companyInfo: CompanyInfo;  // Información de la empresa
  items: InvoiceItem[];      // Items de la factura
  subtotal: number;          // Subtotal sin impuestos
  taxAmount: number;         // Importe del IVA
  total: number;             // Total con impuestos
  status: InvoiceStatus;     // Estado de la factura
  auditTrail: AuditLog[];    // Trazabilidad SIF
  // ... campos adicionales
}
```

#### `AuditLog`
```typescript
interface AuditLog {
  action: string;            // Acción realizada
  userId: string;            // Usuario que realizó la acción
  timestamp: Date;           // Fecha y hora
  details: string;           // Detalles de la acción
  ipAddress: string;         // IP del cliente
  userAgent: string;         // Navegador del cliente
}
```

### 2. Servicios

#### `InvoiceService`
- **Creación de Facturas**: Generación automática con validaciones
- **Numeración Secuencial**: Sistema por año fiscal (YY-0001, YY-0002...)
- **Generación XML**: Formato Facturae estándar español
- **Generación PDF**: Facturas imprimibles
- **Exportación AEAT**: XML para la Administración
- **Auditoría**: Logs automáticos de todas las operaciones

### 3. Componentes de UI

#### `InvoiceGenerator`
- **Formulario de Empresa**: Captura de datos fiscales
- **Gestión de Items**: Añadir/eliminar servicios
- **Cálculo Automático**: Totales e impuestos
- **Validaciones**: Verificación de campos obligatorios
- **Cumplimiento Legal**: Información sobre RD 1007/2023

#### `InvoiceManager`
- **Lista de Facturas**: Vista de todas las facturas emitidas
- **Filtros Avanzados**: Por estado, fecha, paciente, número
- **Descarga PDF**: Generación de facturas imprimibles
- **Exportación AEAT**: XML para cumplimiento legal
- **Gestión de Estados**: Control del ciclo de vida

## Cumplimiento del Reglamento Verifactu

### 1. Trazabilidad (Art. 6 RD 1007/2023)
- ✅ **Registro de Operaciones**: Todas las acciones se registran automáticamente
- ✅ **Auditoría Completa**: Logs con timestamp, usuario, IP y detalles
- ✅ **Conservación**: Datos almacenados según período legal requerido
- ✅ **Accesibilidad**: Disponibilidad inmediata para inspecciones

### 2. Integridad de Datos (Art. 7 RD 1007/2023)
- ✅ **Formato XML Estándar**: Facturae 3.2.2 oficial
- ✅ **Validaciones Automáticas**: Verificación de campos obligatorios
- ✅ **Cálculos Precisos**: IVA y totales según normativa
- ✅ **Numeración Secuencial**: Sistema automático sin duplicados

### 3. Seguridad (Art. 8 RD 1007/2023)
- ✅ **Autenticación**: Solo usuarios autorizados pueden acceder
- ✅ **Autorización**: Cada usuario solo ve sus propias facturas
- ✅ **Registro de Accesos**: Logs de todas las operaciones
- ✅ **Protección de Datos**: Cumplimiento RGPD

### 4. Formato Legal (Art. 9 RD 1007/2023)
- ✅ **XML Facturae**: Estándar oficial español
- ✅ **Campos Obligatorios**: Todos los requisitos legales incluidos
- ✅ **Estructura Correcta**: Validación de esquema XML
- ✅ **Referencias Legales**: Artículos de la Ley del IVA

## Flujo de Trabajo

### 1. Creación de Factura
```
Registro Médico → Botón Facturar → Formulario Empresa → Items → Validación → Generación
```

### 2. Proceso de Validación
```
Datos Empresa → Campos Obligatorios → Items Válidos → Cálculos Correctos → Generación
```

### 3. Generación de Documentos
```
Factura → XML Facturae → PDF Imprimible → Logs Auditoría → Base de Datos
```

### 4. Exportación para AEAT
```
Selección Factura → Generación XML → Firma Digital → Descarga Archivo
```

## Uso del Sistema

### 1. Generar Factura
1. Ir al historial de registros médicos
2. Hacer clic en el botón de facturación (📄) del paciente
3. Completar información de la empresa
4. Configurar items y precios
5. Generar factura

### 2. Gestionar Facturas
1. Acceder al gestor de facturas
2. Ver lista de todas las facturas emitidas
3. Aplicar filtros según necesidades
4. Descargar PDF o exportar para AEAT

### 3. Cumplimiento Legal
1. Todas las facturas se generan en formato Facturae
2. Trazabilidad automática de todas las operaciones
3. Exportación directa para la AEAT
4. Cumplimiento completo del RD 1007/2023

## Ventajas del Sistema

### 🏛️ **Cumplimiento Legal 100%**
- Cumple rigurosamente con el Reglamento Verifactu
- Formato oficial para la Administración española
- Validaciones automáticas de requisitos legales

### 🔒 **Seguridad y Trazabilidad**
- Auditoría completa de todas las operaciones
- Logs automáticos para inspecciones
- Protección de datos según RGPD

### 💼 **Profesional y Confiable**
- Facturas de aspecto profesional
- Cálculos automáticos precisos
- Gestión completa del ciclo de facturación

### 🚀 **Fácil de Usar**
- Interfaz intuitiva y moderna
- Generación automática desde registros médicos
- Exportación directa para cumplimiento legal

## Soporte Técnico

### Dependencias
- `jspdf`: Generación de PDFs
- `html2canvas`: Conversión HTML a PDF
- `firebase/firestore`: Base de datos y autenticación

### Configuración
- Reglas de Firestore actualizadas para facturas
- Tipos TypeScript completos
- Servicios de facturación integrados

### Mantenimiento
- Logs automáticos para debugging
- Validaciones robustas para prevenir errores
- Sistema de auditoría para seguimiento

## Conclusión

Este sistema de facturación proporciona una solución completa y profesional que cumple rigurosamente con todos los requisitos del **Real Decreto 1007/2023 (Reglamento Verifactu)**. Garantiza la trazabilidad, integridad y seguridad de los datos de facturación, proporcionando a los usuarios una herramienta confiable para la gestión fiscal de su actividad médica.

---

**Desarrollado con estándares de calidad profesional y cumplimiento legal completo.**
