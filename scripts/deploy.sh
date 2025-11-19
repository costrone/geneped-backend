#!/bin/bash

# Script de despliegue completo con verificaciones
# Uso: ./scripts/deploy.sh [hosting|functions|firestore|all]

set -e  # Salir si hay algún error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
print_info() {
    echo -e "${GREEN}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    print_error "No se encontró package.json. Asegúrate de estar en la raíz del proyecto."
    exit 1
fi

print_info "Iniciando proceso de despliegue...\n"

# Verificar Node.js
print_info "Verificando Node.js..."
NODE_VERSION=$(node --version)
print_success "Node.js versión: $NODE_VERSION"

# Verificar npm
print_info "Verificando npm..."
NPM_VERSION=$(npm --version)
print_success "npm versión: $NPM_VERSION\n"

# Verificar Firebase CLI
print_info "Verificando Firebase CLI..."
if ! command -v firebase &> /dev/null; then
    print_error "Firebase CLI no está instalado. Instálalo con: npm install -g firebase-tools"
    exit 1
fi
FIREBASE_VERSION=$(firebase --version)
print_success "Firebase CLI versión: $FIREBASE_VERSION\n"

# Verificar autenticación de Firebase
print_info "Verificando autenticación de Firebase..."
if ! firebase login:list &> /dev/null || [ -z "$(firebase login:list | grep -v 'No authorized accounts')" ]; then
    print_warning "No estás autenticado en Firebase. Ejecutando firebase login..."
    firebase login
fi
print_success "Autenticación de Firebase verificada\n"

# Verificar proyecto de Firebase
print_info "Verificando proyecto de Firebase..."
CURRENT_PROJECT=$(firebase use 2>&1 | grep -oP '(?<=Using )\S+' || echo "")
if [ -z "$CURRENT_PROJECT" ]; then
    print_warning "No hay un proyecto de Firebase seleccionado."
    print_info "Proyectos disponibles:"
    firebase projects:list
    read -p "Ingresa el ID del proyecto a usar: " PROJECT_ID
    firebase use "$PROJECT_ID"
else
    print_success "Proyecto actual: $CURRENT_PROJECT"
fi
echo ""

# Verificar variables de entorno
print_info "Verificando variables de entorno..."
if [ -f ".env.local" ]; then
    # Cargar variables de entorno
    export $(cat .env.local | grep -v '^#' | xargs)
    print_success "Archivo .env.local encontrado"
else
    print_warning "Archivo .env.local no encontrado"
    print_warning "Asegúrate de configurar las variables de entorno en la plataforma de despliegue"
fi

# Verificar variables requeridas
if ! node scripts/verify-env.js; then
    print_error "Faltan variables de entorno requeridas"
    print_info "Por favor, configura las variables antes de continuar"
    exit 1
fi
echo ""

# Determinar qué desplegar
DEPLOY_TARGET=${1:-all}

case $DEPLOY_TARGET in
    hosting)
        print_info "Desplegando solo Hosting..."
        print_info "Limpiando build anterior..."
        rm -rf build/
        
        print_info "Construyendo aplicación..."
        npm run build
        
        if [ ! -d "build" ] || [ ! -f "build/index.html" ]; then
            print_error "El build falló o no se generó correctamente"
            exit 1
        fi
        print_success "Build completado correctamente"
        
        print_info "Desplegando a Firebase Hosting..."
        firebase deploy --only hosting
        print_success "Hosting desplegado correctamente"
        ;;
    
    functions)
        print_info "Desplegando solo Functions..."
        cd functions
        
        print_info "Instalando dependencias de functions..."
        npm install
        
        print_info "Compilando functions..."
        npm run build
        
        if [ ! -d "lib" ] || [ ! -f "lib/index.js" ]; then
            print_error "La compilación de functions falló"
            exit 1
        fi
        print_success "Functions compiladas correctamente"
        
        cd ..
        print_info "Desplegando functions a Firebase..."
        firebase deploy --only functions
        print_success "Functions desplegadas correctamente"
        ;;
    
    firestore)
        print_info "Desplegando reglas e índices de Firestore..."
        firebase deploy --only firestore:rules,firestore:indexes
        print_success "Firestore desplegado correctamente"
        ;;
    
    all)
        print_info "Desplegando todo (Hosting + Functions + Firestore)..."
        
        # Build
        print_info "Limpiando build anterior..."
        rm -rf build/
        
        print_info "Construyendo aplicación..."
        npm run build
        
        if [ ! -d "build" ] || [ ! -f "build/index.html" ]; then
            print_error "El build falló o no se generó correctamente"
            exit 1
        fi
        print_success "Build completado correctamente"
        
        # Functions
        print_info "Compilando functions..."
        cd functions
        npm install
        npm run build
        cd ..
        print_success "Functions compiladas correctamente"
        
        # Deploy
        print_info "Desplegando a Firebase..."
        firebase deploy
        print_success "Despliegue completo finalizado"
        ;;
    
    *)
        print_error "Opción inválida: $DEPLOY_TARGET"
        echo "Uso: ./scripts/deploy.sh [hosting|functions|firestore|all]"
        exit 1
        ;;
esac

echo ""
print_success "🎉 ¡Despliegue completado exitosamente!"
print_info "Verifica tu aplicación en Firebase Console"

