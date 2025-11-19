# Optimización de Costos - Google Cloud / Firebase

## ✅ Servicios Activos y Límites Gratuitos

### Firebase Authentication
- **Estado**: ✅ Gratis (sin límites relevantes)
- **Uso**: Autenticación de usuarios
- **Acción**: No requiere cambios

### Firestore Database
- **Estado**: ⚠️ Gratis hasta 50K lecturas/día y 20K escrituras/día
- **Uso**: Almacenamiento de pacientes e historiales médicos
- **Monitoreo**: Google Cloud Console → Firestore → Usage
- **Optimización**: 
  - Las consultas ya filtran por userId (eficiente)
  - Considera paginación si el volumen crece mucho

### Firebase Storage
- **Estado**: ⚠️ Gratis hasta 5 GB almacenamiento
- **Uso**: Almacenamiento de documentos adjuntos y PDFs
- **Monitoreo**: Google Cloud Console → Storage → Buckets
- **Optimización**:
  - Limpia documentos antiguos periódicamente
  - Comprime imágenes antes de subirlas

### Firebase Hosting
- **Estado**: ✅ Gratis hasta 10 GB almacenamiento y 360 MB/día transferencia
- **Uso**: Hosting de la aplicación web
- **Monitoreo**: Firebase Console → Hosting → Usage
- **Acción**: No requiere cambios

### Cloud Functions
- **Estado**: ⚠️ NO SE ESTÁN USANDO
- **Problema**: Las funciones están definidas pero no se llaman desde el código
- **Costos potenciales**: 
  - Solo generan costos si están desplegadas e invocadas
  - Container Registry Scanning ya desactivado ✅
- **Recomendación**: 
  - **Eliminar funciones desplegadas** si no se usan
  - O mantener el código pero no desplegarlas

## 🔍 Cómo Verificar y Eliminar Functions Desplegadas

### Desde Firebase Console:
1. Ve a https://console.firebase.google.com
2. Selecciona tu proyecto `geneped-app-f4431`
3. Ve a "Functions" en el menú lateral
4. Si aparecen funciones desplegadas (`generateProtectedPDF`, `sendEmailWithAttachment`):
   - Haz clic en cada función
   - Clic en "Eliminar" o "Delete"
   - Confirma la eliminación

### Desde Terminal (si prefieres CLI):
```bash
# Ver funciones desplegadas
firebase functions:list

# Eliminar una función específica
firebase functions:delete generateProtectedPDF
firebase functions:delete sendEmailWithAttachment
```

## 📊 Monitoreo de Costos

### Google Cloud Console → Billing:
1. Ve a https://console.cloud.google.com/billing
2. Selecciona tu proyecto
3. Ve a "Reports" para ver desglose de costos
4. Filtra por servicio:
   - Container Registry / Artifact Registry
   - Cloud Functions
   - Firestore
   - Cloud Storage (Firebase Storage)

### Configurar Alertas de Costo:
1. Google Cloud Console → Billing → Budgets & alerts
2. Crea un presupuesto (p. ej. €5/mes)
3. Configura alertas al 50%, 90% y 100%

## 💡 Recomendaciones Adicionales

1. **Eliminar Container Analysis API** (ya no necesario):
   - Google Cloud Console → APIs & Services → Enabled APIs
   - Busca "Container Analysis API" o "Container Scanning API"
   - Desactívala si está habilitada

2. **Verificar Artifact Registry** (si existe):
   - Google Cloud Console → Artifact Registry
   - Verifica que el análisis de vulnerabilidades esté desactivado
   - Elimina repositorios no utilizados

3. **Limitar invocaciones de Functions** (si las mantienes):
   - Configura cuotas en Cloud Functions
   - Establece límites diarios o mensuales

4. **Optimizar consultas Firestore**:
   - Ya implementado: consultas filtran por userId ✅
   - Considera índices compuestos para consultas complejas
   - Usa paginación para listas grandes

## ✅ Checklist de Optimización

- [x] Container Registry Vulnerability Scanning desactivado
- [ ] Cloud Functions eliminadas o no desplegadas (verificar)
- [ ] Container Analysis API desactivada (verificar)
- [ ] Alertas de costo configuradas
- [ ] Monitoreo de uso activado

## 📝 Notas

- **Costo actual**: €2.66 por Container Registry Scanning (ya desactivado, no habrá más)
- **Sin nuevas cargas esperadas** si:
  - Functions no están desplegadas o están eliminadas
  - No excedes límites gratuitos de Firestore/Storage/Hosting
- **Recomendación principal**: Eliminar las Cloud Functions si no se usan (ahorra costos y complejidad)

