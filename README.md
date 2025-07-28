# Geneped - Sistema de Gestión de Historiales Médicos

Una aplicación web para genetistas clínicos que permite crear, gestionar y generar PDFs protegidos de historiales médicos de pacientes.

## Características

- ✅ **Creación de historiales médicos** con datos del paciente (nombre, apellidos, DNI)
- ✅ **Generación de PDFs protegidos** con contraseña basada en el DNI del paciente
- ✅ **Sistema de autenticación** con Firebase Auth
- ✅ **Almacenamiento seguro** en Firestore
- ✅ **Búsqueda y filtros avanzados** por nombre, apellidos, DNI, fecha y palabras clave
- ✅ **Interfaz moderna y responsive** con Tailwind CSS
- ✅ **Despliegue en Firebase Hosting**

## Tecnologías Utilizadas

- **Frontend**: React 18 + TypeScript
- **Estilos**: Tailwind CSS
- **Backend**: Firebase (Firestore, Auth, Storage)
- **Formularios**: React Hook Form + Yup
- **PDFs**: jsPDF
- **Iconos**: Lucide React
- **Routing**: React Router DOM

## Instalación

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd geneped-app
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar Firebase

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/)
2. Habilita Authentication, Firestore y Storage
3. Crea una aplicación web y obtén las credenciales
4. Copia el archivo `env.example` a `.env.local` y completa las variables:

```bash
cp env.example .env.local
```

Edita `.env.local` con tus credenciales de Firebase:

```env
REACT_APP_FIREBASE_API_KEY=tu_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=tu_proyecto_id
REACT_APP_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
REACT_APP_FIREBASE_APP_ID=tu_app_id
```

### 4. Configurar Firestore

Ejecuta los siguientes comandos para configurar las reglas e índices:

```bash
# Instalar Firebase CLI si no lo tienes
npm install -g firebase-tools

# Iniciar sesión en Firebase
firebase login

# Inicializar el proyecto (selecciona tu proyecto)
firebase init

# Desplegar reglas e índices
firebase deploy --only firestore:rules,firestore:indexes
```

### 5. Crear usuario de administrador

1. Ve a Firebase Console > Authentication
2. Habilita la autenticación por email/password
3. Crea un usuario administrador

### 6. Ejecutar la aplicación

```bash
npm start
```

La aplicación estará disponible en `http://localhost:3000`

## Uso

### 1. Iniciar Sesión

- Accede a la aplicación con las credenciales de administrador creadas en Firebase

### 2. Crear Historial Médico

- Ve a "Nuevo Historial"
- Completa los datos del paciente (nombre, apellidos, DNI)
- Redacta el informe médico
- Haz clic en "Generar Documento"
- Descarga el PDF generado

### 3. Gestionar Historiales

- Ve a "Historial" para ver todos los registros
- Usa los filtros para buscar por:
  - Nombre del paciente
  - Apellidos
  - DNI
  - Fecha de creación
  - Palabras clave en el informe

## Generación de Contraseñas

Los PDFs se protegen con una contraseña generada automáticamente:
- **Formato**: 3 últimos dígitos del DNI + letra del DNI
- **Ejemplo**: Para DNI "12345678A" → contraseña "678A"

## Despliegue

### Firebase Hosting

```bash
# Construir la aplicación
npm run build

# Desplegar a Firebase
firebase deploy
```

### Netlify (Alternativo)

1. Conecta tu repositorio a Netlify
2. Configura las variables de entorno en Netlify
3. El build se ejecutará automáticamente

## Estructura del Proyecto

```
src/
├── components/          # Componentes React
│   ├── CreateRecord.tsx # Formulario de creación
│   ├── RecordHistory.tsx # Lista de historiales
│   ├── Login.tsx        # Autenticación
│   ├── Header.tsx       # Navegación
│   └── PrivateRoute.tsx # Protección de rutas
├── contexts/            # Contextos de React
│   └── UserContext.tsx  # Contexto de usuario
├── services/            # Servicios de Firebase
│   ├── firebase.ts      # Operaciones de base de datos
│   └── pdfService.ts    # Generación de PDFs
├── types/               # Tipos TypeScript
│   └── index.ts         # Interfaces
└── firebase/            # Configuración de Firebase
    └── config.ts        # Inicialización
```

## Seguridad

- ✅ Autenticación requerida para todas las operaciones
- ✅ Reglas de Firestore que solo permiten acceso a usuarios autenticados
- ✅ Validación de formularios en frontend y backend
- ✅ Contraseñas de PDF basadas en datos del paciente

## Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## Soporte

Para soporte técnico o preguntas, contacta con el equipo de desarrollo.
