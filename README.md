# AutoMed

AutoMed es una aplicación web de telemedicina para la gestión de pacientes, profesionales sanitarios, citas médicas, planes de medicación, hábitos de salud, teleconsultas, informes médicos firmados y auditoría de accesos.

La aplicación está separada en dos partes:

- `backend`: API REST con Node.js, Express, TypeScript, MySQL, JWT y Socket.IO.
- `frontend`: aplicación Angular con módulos para pacientes, profesionales y administración.

## Funcionalidades

- Autenticación con roles: `PACIENTE`, `DOCTOR` y `ADMIN`.
- Calendario de citas médicas y medicación.
- Registro y seguimiento de hábitos de salud.
- Evolución del paciente con visualización de datos clínicos.
- Teleconsulta con mensajería en tiempo real.
- Gestión de informes médicos, firma digital y descarga de PDF.
- Módulo profesional para seguimiento de pacientes.
- Módulo administrador con pacientes, catálogo y control de logs.
- Auditoría de accesos a informes médicos.

## Requisitos

- Node.js 20 LTS recomendado.
- npm.
- MySQL 8.
- Angular CLI, opcional para trabajar con comandos globales.

El proyecto puede compilar con otras versiones recientes de Node, aunque Node impar puede mostrar avisos por no ser LTS.

## Estructura

```text
autoMed/
├── backend/                 API Express + TypeScript
├── frontend/                Aplicación Angular
├── bd/
│   ├── structure/           Script base de base de datos
│   └── data/                Migraciones incrementales
├── storage/                 Ficheros generados: reportes y firmas
├── init.sh                  Instalación inicial de dependencias
└── README.md
```

## Instalación rápida

Desde la raíz del proyecto:

```bash
chmod +x init.sh
./init.sh
```

El script instala dependencias de backend y frontend y crea los `.env` desde los ejemplos.

## Configuración

### Backend

Edita `backend/.env`:

```env
NODE_ENV=development
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=telemedicina_tfg

JWT_SECRET=cambia_este_valor
JWT_EXPIRY=7d

CORS_ORIGIN=http://localhost:4200
```

### Frontend

Edita `frontend/.env` si necesitas cambiar la URL de la API:

```env
NG_APP_API_URL=http://localhost:3000/api
NG_APP_ENV=development
NG_APP_LOG_LEVEL=debug
```

## Base de datos

### Crear la base desde cero

Desde la raíz del proyecto:

```bash
mysql -u root -p < bd/structure/db_script.sql
```

Si el script no crea la base en tu instalación, crea primero la base y luego importa:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS telemedicina_tfg CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p telemedicina_tfg < bd/structure/db_script.sql
```

### Aplicar migraciones

Después del script base, aplica los scripts incrementales de `bd/data` en orden:

```bash
mysql -u root -p telemedicina_tfg < bd/data/202605011242_add_roles.sql
mysql -u root -p telemedicina_tfg < bd/data/202605151030_add_reports_module.sql
mysql -u root -p telemedicina_tfg < bd/data/202605151100_add_reports_module_v2.sql
mysql -u root -p telemedicina_tfg < bd/data/202605151130_make_report_consultation_optional.sql
mysql -u root -p telemedicina_tfg < bd/data/202605161200_add_teleconsultation_module.sql
mysql -u root -p telemedicina_tfg < bd/data/202605221545_add_medication_alarm_end_date.sql
mysql -u root -p telemedicina_tfg < bd/data/202605221930_add_admin_catalog_crud.sql
mysql -u root -p telemedicina_tfg < bd/data/202605221945_remove_meet_urls_from_locations.sql
```

Para comprobar una columna o tabla:

```bash
mysql -u root -p telemedicina_tfg -e "SHOW TABLES;"
mysql -u root -p telemedicina_tfg -e "DESCRIBE medication_alarms;"
```

## Ejecutar en desarrollo

Abre dos terminales.

Backend:

```bash
cd backend
npm install
npm run dev
```

La API queda disponible en:

```text
http://localhost:3000/api
```

Frontend:

```bash
cd frontend
npm install
npm start
```

La aplicación queda disponible en:

```text
http://localhost:4200
```

## Compilar

Backend:

```bash
cd backend
npm run build
```

Ejecutar backend compilado:

```bash
cd backend
npm start
```

Frontend:

```bash
cd frontend
npm run build
```

Build de producción:

```bash
cd frontend
npm run build:prod
```

## Tests

Backend:

```bash
cd backend
npm test
```

Frontend:

```bash
cd frontend
npm test
```

## Lint

Backend:

```bash
cd backend
npm run lint
```

Frontend:

```bash
cd frontend
npm run lint
```

## Rutas principales

Frontend:

- `/`: página pública.
- `/auth`: login y registro.
- `/calendar`: calendario de citas y medicación.
- `/habits`: registro de hábitos.
- `/evolution`: evolución del paciente.
- `/reports`: informes médicos.
- `/teleconsulta`: teleconsulta.
- `/professional/patients`: seguimiento profesional de pacientes.
- `/admin/patients`: administración de pacientes.
- `/admin/catalog`: catálogo.
- `/admin/logs`: control de logs.

Backend:

- `/api/auth`
- `/api/users`
- `/api/appointments`
- `/api/medications`
- `/api/habits`
- `/api/reports`
- `/api/report-types`
- `/api/teleconsultations`
- `/api/patient-profiles`
- `/api/professional-profiles`
- `/api/admin`

## Almacenamiento local

El proyecto usa `storage/` para guardar ficheros generados por la aplicación, como:

- PDFs de informes médicos.
- Resúmenes de teleconsulta.
- Imágenes de firmas digitales.

No subas ficheros sensibles reales a repositorios públicos.

## Seguridad

- Las contraseñas se almacenan con hash `bcryptjs`.
- La autenticación usa JWT.
- El backend aplica CORS y Helmet.
- El acceso a módulos depende del rol del usuario.
- Los accesos a informes médicos se registran en auditoría.

Antes de desplegar:

- Cambia `JWT_SECRET`.
- Usa credenciales de base de datos no privilegiadas.
- Revisa `CORS_ORIGIN`.
- No publiques `.env`.
- Evita datos clínicos reales en entornos de prueba.

## Solución de problemas

### Error de conexión a MySQL

Revisa `backend/.env` y comprueba que MySQL esté activo:

```bash
mysql -u root -p -e "SELECT 1;"
```

### Error de CORS

Comprueba que `CORS_ORIGIN` en `backend/.env` coincide con la URL del frontend:

```env
CORS_ORIGIN=http://localhost:4200
```

### El frontend no llama a la API correcta

Revisa `frontend/.env`:

```env
NG_APP_API_URL=http://localhost:3000/api
```

### Cambios de backend no aparecen

Si ejecutas el backend compilado, vuelve a compilar:

```bash
cd backend
npm run build
npm start
```

## Derechos de autor

Copyright © 2026 Carolina Fernández. Todos los derechos reservados.

Este proyecto forma parte de AutoMed. Queda prohibida la copia, distribución, modificación o uso comercial sin autorización expresa de la titular de los derechos.
