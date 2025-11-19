# 🚀 Guía Rápida de Despliegue - Geneped App

## ⚡ Acciones Inmediatas (Hacer AHORA)

### 1. 🔴 CRÍTICO: Configurar Variables de Entorno

**El problema más común es que las variables de entorno no están configuradas en producción.**

#### Para Firebase Hosting:

Las variables de entorno **NO se pueden configurar directamente** en Firebase Hosting como en Netlify. Tienes dos opciones:

**Opción A: Usar archivo de configuración en tiempo de build (RECOMENDADO)**

1. Asegúrate de que tu archivo `.env.local` tiene todas las variables:
```bash
# Verificar que existe
cat .env.local

# Debe contener:
REACT_APP_FIREBASE_API_KEY=tu_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=tu_proyecto_id
REACT_APP_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
REACT_APP_FIREBASE_APP_ID=tu_app_id
```

2. Las variables se inyectan durante el build, así que **debes tenerlas configuradas ANTES de ejecutar `npm run build`**

**Opción B: Usar Firebase Remote Config (Más complejo pero más seguro)**

Ver documentación completa en `ANALISIS_DESPLIEGUE.md` sección 11.

#### Para Netlify:

1. Ve a tu proyecto en Netlify Dashboard
2. Settings → Environment variables
3. Añade todas las variables `REACT_APP_*`
4. **IMPORTANTE:** Reinicia el build después de añadir variables

---

### 2. 🔴 CRÍTICO: Verificar Autenticación Firebase

```bash
# Verificar si estás autenticado
firebase login:list

# Si no estás autenticado
firebase login

# Verificar proyecto actual
firebase use

# Si necesitas cambiar de proyecto
firebase use geneped-app-f4431
```

---

### 3. 🟡 IMPORTANTE: Verificar Variables Antes de Desplegar

```bash
# Verificar que todas las variables están configuradas
npm run verify:env

# Si falta alguna, configúrala en .env.local
```

---

## 📝 Pasos de Despliegue Completos

### Paso 1: Preparación

```bash
# 1. Verificar que estás en la raíz del proyecto
pwd  # Debe ser: .../geneped-app

# 2. Verificar Node.js (debe ser >= 18)
node --version

# 3. Instalar dependencias (si no están instaladas)
npm install

# 4. Verificar variables de entorno
npm run verify:env
```

### Paso 2: Build Local (Probar primero)

```bash
# Limpiar build anterior
npm run build:clean

# O simplemente
npm run build

# Verificar que se creó el directorio build/
ls -la build/
```

### Paso 3: Compilar Functions (si las usas)

```bash
cd functions
npm install
npm run build
cd ..

# Verificar que se creó lib/index.js
ls -la functions/lib/
```

### Paso 4: Desplegar

#### Opción A: Desplegar Todo
```bash
npm run deploy:all
```

#### Opción B: Desplegar Solo Hosting
```bash
npm run deploy:hosting
```

#### Opción C: Desplegar Solo Functions
```bash
npm run deploy:functions
```

#### Opción D: Usar Script Automatizado
```bash
./scripts/deploy.sh all
```

---

## 🔍 Diagnóstico de Problemas Comunes

### Error: "Variables de entorno no definidas"

**Solución:**
```bash
# 1. Verificar que .env.local existe
ls -la .env.local

# 2. Verificar contenido
cat .env.local

# 3. Si no existe, copiar desde ejemplo
cp env.example .env.local

# 4. Editar con tus credenciales
nano .env.local  # o usar tu editor preferido
```

### Error: "Firebase: No project selected"

**Solución:**
```bash
# Ver proyectos disponibles
firebase projects:list

# Seleccionar proyecto
firebase use geneped-app-f4431

# O crear uno nuevo
firebase projects:create mi-proyecto-nuevo
firebase use mi-proyecto-nuevo
```

### Error: "Build failed"

**Solución:**
```bash
# 1. Limpiar todo
rm -rf build/ node_modules/ package-lock.json

# 2. Reinstalar
npm install

# 3. Intentar build de nuevo
npm run build

# 4. Si falla, ver errores específicos
npm run build 2>&1 | tee build-errors.log
```

### Error: "Functions deployment failed"

**Solución:**
```bash
# 1. Ir a functions
cd functions

# 2. Limpiar
rm -rf lib/ node_modules/ package-lock.json

# 3. Reinstalar
npm install

# 4. Compilar
npm run build

# 5. Verificar que se creó lib/index.js
ls -la lib/

# 6. Volver a raíz y desplegar
cd ..
firebase deploy --only functions
```

---

## ✅ Checklist Pre-Despliegue

Antes de desplegar, verifica:

- [ ] ✅ Variables de entorno configuradas (`.env.local` o en plataforma)
- [ ] ✅ Firebase CLI instalado (`firebase --version`)
- [ ] ✅ Autenticado en Firebase (`firebase login:list`)
- [ ] ✅ Proyecto Firebase seleccionado (`firebase use`)
- [ ] ✅ Build local funciona (`npm run build`)
- [ ] ✅ Functions compiladas (si las usas) (`cd functions && npm run build`)
- [ ] ✅ Servicios Firebase habilitados (Auth, Firestore, Storage)
- [ ] ✅ Reglas de Firestore configuradas

---

## 🎯 Comandos Rápidos de Referencia

```bash
# Verificar estado
npm run verify:env              # Verificar variables de entorno
firebase login:list            # Ver autenticación
firebase use                   # Ver proyecto actual

# Build
npm run build                  # Build normal
npm run build:clean           # Limpiar y build
npm run build:verify          # Verificar y build

# Deploy
npm run deploy                # Deploy completo con verificación
npm run deploy:hosting        # Solo hosting
npm run deploy:functions      # Solo functions
npm run deploy:firestore      # Solo reglas de Firestore
npm run deploy:all            # Todo (hosting + functions + firestore)

# Script automatizado
./scripts/deploy.sh all       # Deploy completo con verificaciones
./scripts/deploy.sh hosting   # Solo hosting
./scripts/deploy.sh functions # Solo functions
```

---

## 📚 Documentación Adicional

Para más detalles sobre cada problema y solución, consulta:

- **`ANALISIS_DESPLIEGUE.md`** - Análisis exhaustivo de todos los problemas posibles
- **`README.md`** - Documentación general del proyecto
- **Firebase Docs:** https://firebase.google.com/docs/hosting
- **Netlify Docs:** https://docs.netlify.com/

---

## 🆘 Si Nada Funciona

1. **Revisar logs específicos:**
   ```bash
   # Logs de Firebase Functions
   firebase functions:log
   
   # Logs en tiempo real
   firebase functions:log --follow
   ```

2. **Verificar en Firebase Console:**
   - Firebase Console → Hosting → Deploy History
   - Firebase Console → Functions → Logs

3. **Probar en modo desarrollo local:**
   ```bash
   npm start
   # Abrir http://localhost:3000
   # Verificar que funciona localmente primero
   ```

4. **Contactar soporte:**
   - Firebase Support: https://firebase.google.com/support
   - Revisar `ANALISIS_DESPLIEGUE.md` para soluciones detalladas

---

**Última actualización:** $(date)

