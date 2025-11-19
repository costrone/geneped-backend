#!/usr/bin/env node

/**
 * Script para verificar que todas las variables de entorno requeridas están configuradas
 * Uso: node scripts/verify-env.js
 */

const fs = require('fs');
const path = require('path');

// Cargar variables de entorno desde .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    // Ignorar comentarios y líneas vacías
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        process.env[key.trim()] = value;
      }
    }
  });
}

const requiredVars = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID',
];

const optionalVars = [
  'REACT_APP_EMAILJS_SERVICE_ID',
  'REACT_APP_EMAILJS_TEMPLATE_ID',
  'REACT_APP_EMAILJS_PUBLIC_KEY',
];

console.log('🔍 Verificando variables de entorno...\n');

let hasErrors = false;
const missingRequired = [];
const missingOptional = [];

// Verificar variables requeridas
requiredVars.forEach(varName => {
  if (!process.env[varName]) {
    missingRequired.push(varName);
    hasErrors = true;
  }
});

// Verificar variables opcionales
optionalVars.forEach(varName => {
  if (!process.env[varName]) {
    missingOptional.push(varName);
  }
});

// Mostrar resultados
if (missingRequired.length > 0) {
  console.error('❌ ERROR: Variables de entorno REQUERIDAS faltantes:\n');
  missingRequired.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\n⚠️  Estas variables son OBLIGATORIAS para que la aplicación funcione.');
  console.error('   Configúralas en tu archivo .env.local o en la plataforma de despliegue.\n');
}

if (missingOptional.length > 0) {
  console.warn('⚠️  ADVERTENCIA: Variables de entorno OPCIONALES faltantes:\n');
  missingOptional.forEach(varName => {
    console.warn(`   - ${varName}`);
  });
  console.warn('\n   Estas variables son opcionales pero recomendadas para funcionalidad completa.\n');
}

if (missingRequired.length === 0 && missingOptional.length === 0) {
  console.log('✅ Todas las variables de entorno están configuradas correctamente.\n');
} else if (missingRequired.length === 0) {
  console.log('✅ Todas las variables REQUERIDAS están configuradas.\n');
  console.log('⚠️  Algunas variables opcionales faltan, pero la aplicación funcionará.\n');
}

// Mostrar resumen
const totalRequired = requiredVars.length;
const totalOptional = optionalVars.length;
const foundRequired = totalRequired - missingRequired.length;
const foundOptional = totalOptional - missingOptional.length;

console.log('📊 Resumen:');
console.log(`   Requeridas: ${foundRequired}/${totalRequired} ✅`);
console.log(`   Opcionales: ${foundOptional}/${totalOptional} ${foundOptional === totalOptional ? '✅' : '⚠️'}\n`);

// Salir con código de error si faltan variables requeridas
if (hasErrors) {
  console.error('❌ El build fallará sin estas variables. Por favor, configúralas antes de continuar.\n');
  process.exit(1);
}

console.log('✅ Verificación completada. Puedes continuar con el build.\n');
process.exit(0);

