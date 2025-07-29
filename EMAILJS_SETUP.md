# Configuración de EmailJS

## ¿Qué es EmailJS?

EmailJS permite enviar emails directamente desde el frontend de tu aplicación sin necesidad de un servidor backend. Es perfecto para enviar PDFs protegidos por email.

## Pasos para Configurar EmailJS

### 1. Crear cuenta en EmailJS

1. Ve a [EmailJS.com](https://www.emailjs.com/)
2. Crea una cuenta gratuita
3. Verifica tu email

### 2. Configurar Email Service

1. En el dashboard de EmailJS, ve a "Email Services"
2. Haz clic en "Add New Service"
3. Selecciona tu proveedor de email (Gmail, Outlook, etc.)
4. Conecta tu cuenta de email
5. Anota el **Service ID** generado

### 3. Crear Email Template

1. Ve a "Email Templates"
2. Haz clic en "Create New Template"
3. Usa este template como base:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Informe Clínico - {{patient_name}}</title>
</head>
<body>
    <h2>Informe Clínico - {{patient_name}}</h2>
    
    <p>Estimado/a,</p>
    
    <p>Adjunto encontrará el informe clínico del paciente {{patient_name}} (DNI: {{patient_dni}}).</p>
    
    <p>El documento está protegido con contraseña por motivos de confidencialidad.</p>
    
    <h3>🔐 Contraseña del PDF: {{password}}</h3>
    
    <p><strong>La contraseña está formada por los últimos 3 dígitos del DNI seguidos de la letra.</strong></p>
    
    <p>Saludos cordiales,<br>
    {{from_email}}<br>
    Geneped - Sistema de Gestión de Historiales</p>
</body>
</html>
```

4. Configura los campos:
   - **To Email**: {{to_email}}
   - **From Email**: {{from_email}}
   - **Subject**: Informe Clínico - {{patient_name}}
   - **Message**: {{message}}

5. Anota el **Template ID** generado

### 4. Obtener Public Key

1. Ve a "Account" en el dashboard
2. Copia tu **Public Key**

### 5. Configurar Variables de Entorno

1. Copia el archivo `env.emailjs.example` como `.env.local`
2. Añade tus credenciales:

```env
REACT_APP_EMAILJS_SERVICE_ID=tu_service_id_aqui
REACT_APP_EMAILJS_TEMPLATE_ID=tu_template_id_aqui
REACT_APP_EMAILJS_PUBLIC_KEY=tu_public_key_aqui
```

### 6. Reiniciar la Aplicación

```bash
npm start
```

## Funcionalidades

### Envío Automático
- ✅ **PDF generado** automáticamente
- ✅ **Email enviado** directamente desde la aplicación
- ✅ **Contraseña incluida** en el email
- ✅ **Sin necesidad** de cliente de email

### Fallback
- 🔄 **Método mailto** como respaldo si EmailJS falla
- 🔄 **Descarga automática** del PDF
- 🔄 **Información de contraseña** proporcionada

## Límites de EmailJS

### Plan Gratuito
- 200 emails por mes
- 2 templates
- 1 email service

### Planes de Pago
- Más emails por mes
- Más templates
- Múltiples servicios de email

## Solución de Problemas

### Error: "Configuración de EmailJS incompleta"
- Verifica que todas las variables de entorno estén configuradas
- Reinicia la aplicación después de cambiar `.env.local`

### Error: "Email no enviado"
- Verifica tu conexión a internet
- Comprueba que el Service ID y Template ID sean correctos
- Revisa los logs en la consola del navegador

### Fallback Activado
- Si EmailJS falla, se usará el método mailto
- El PDF se descargará automáticamente
- Se abrirá tu cliente de email con la información prellenada 