#!/bin/bash

set -e  # Detener en caso de error

# Script de inicialización del proyecto AutoMed

echo "🚀 Inicializando AutoMed..."

# Backend setup
echo ""
echo "📦 Configurando Backend..."
cd backend
cp .env.example .env
if npm install; then
  echo "✅ Backend configurado"
else
  echo "❌ Error en Backend"
  exit 1
fi

# Frontend setup
echo ""
echo "📦 Configurando Frontend..."
cd ../frontend
cp .env.example .env
if npm install; then
  echo "✅ Frontend configurado"
else
  echo "❌ Error en Frontend"
  exit 1
fi

echo ""
echo "🎉 Proyecto inicializado correctamente!"
echo ""
echo "Próximos pasos:"
echo "1. Actualizar variables de entorno en backend/.env"
echo "2. Crear la BD: mysql -u root -p < bd/db_script.sql"
echo "3. Iniciar el backend: cd backend && npm run dev"
echo "4. Iniciar el frontend: cd frontend && npm start"
echo ""
echo "Documentación: Ver DEVELOPMENT.md y README.md"
