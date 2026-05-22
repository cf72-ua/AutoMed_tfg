#!/usr/bin/env bash

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Inicializando AutoMed..."

echo ""
echo "📦 Configurando Backend..."
cd "$ROOT_DIR/backend"
if [ -f .env ]; then
  echo "ℹ️  backend/.env ya existe; no se sobrescribe"
elif [ -f .env.example ]; then
  cp .env.example .env
  echo "✅ backend/.env creado desde .env.example"
fi

if npm install; then
  echo "✅ Backend configurado"
else
  echo "❌ Error en Backend"
  exit 1
fi

echo ""
echo "📦 Configurando Frontend..."
cd "$ROOT_DIR/frontend"
if [ -f .env ]; then
  echo "ℹ️  frontend/.env ya existe; no se sobrescribe"
elif [ -f .env.example ]; then
  cp .env.example .env
  echo "✅ frontend/.env creado desde .env.example"
fi

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
echo "2. Crear la BD base:"
echo "   mysql -u root -p < bd/structure/db_script.sql"
echo "3. Aplicar migraciones de bd/data en orden, por ejemplo:"
echo "   mysql -u root -p telemedicina_tfg < bd/data/202605221545_add_medication_alarm_end_date.sql"
echo "4. Iniciar el backend: cd backend && npm run dev"
echo "5. Iniciar el frontend: cd frontend && npm start"
echo ""
echo "Documentación: README.md"
