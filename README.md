# AutoMed - Platform de Telemedicina

Plataforma completa de telemedicina con gestión de consultas, documentos médicos, medicación y IA para análisis temprano de riesgos.

## 📋 Estructura del Proyecto

```
autoMed/
├── backend/                    # API REST (Node.js + Express + TypeScript)
│   ├── src/
│   │   ├── config/            # Configuración de BD, autenticación
│   │   ├── controllers/       # Controladores HTTP
│   │   ├── services/          # Lógica empresarial
│   │   ├── models/            # DTOs y tipos de entidades
│   │   ├── routes/            # Definición de rutas
│   │   ├── middleware/        # Auth, validación, errores
│   │   ├── validators/        # Validación de datos
│   │   ├── types/             # Tipos TypeScript globales
│   │   ├── utils/             # Funciones auxiliares
│   │   ├── helpers/           # Ayudantes genéricos
│   │   ├── errors/            # Clases de error personalizadas
│   │   ├── db/                # Conexión y migraciones
│   │   └── index.ts           # Punto de entrada
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── frontend/                   # Aplicación Angular
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/
│   │   │   │   ├── services/  # Servicios globales (Auth, API)
│   │   │   │   ├── guards/    # Guards (AuthGuard, RoleGuard)
│   │   │   │   └── interceptors/ # HTTP Interceptors
│   │   │   ├── shared/
│   │   │   │   ├── components/   # Componentes reutilizables
│   │   │   │   ├── directives/   # Directivas personalizadas
│   │   │   │   ├── pipes/        # Pipes personalizados
│   │   │   │   └── models/       # Interfaces compartidas
│   │   │   ├── features/      # Módulos por funcionalidad
│   │   │   │   ├── auth/      # Login, Registro
│   │   │   │   ├── patients/  # Panel de pacientes
│   │   │   │   ├── professionals/ # Panel de profesionales
│   │   │   │   ├── consultations/ # Teleconsultas
│   │   │   │   ├── documents/ # Gestión de documentos
│   │   │   │   ├── reports/   # Reportes PDF
│   │   │   │   ├── medications/ # Gestión de medicación
│   │   │   │   └── admin/     # Panel administrativo
│   │   │   └── app.component.ts
│   │   ├── assets/
│   │   ├── environments/      # Configuración por entorno
│   │   ├── styles.scss        # Estilos globales
│   │   ├── main.ts
│   │   └── index.html
│   ├── angular.json
│   ├── tsconfig.json
│   ├── package.json
│   └── .env.example
│
├── bd/
│   └── db_script.sql          # Script de creación de BD
│
└── README.md
```

## 🔧 Tecnologías Utilizadas

### Backend
- **Node.js** con **Express.js**
- **TypeScript** para tipado estático
- **MySQL 8.x** para almacenamiento
- **JWT** para autenticación
- **Socket.io** para comunicación en tiempo real (consultas)
- **Multer** para carga de archivos

### Frontend
- **Angular 17+** (framework)
- **TypeScript** para componentes
- **NgRx** para gestión de estado
- **Angular Material** para UI
- **RxJS** para programación reactiva
- **Socket.io-client** para WebSocket

## 🚀 Primeros Pasos

### Instalación Backend

```bash
cd backend
cp .env.example .env          # Configurar variables de entorno
npm install
npm run build
npm run dev                    # Desarrollo con ts-node
```

### Instalación Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm start                      # ng serve en puerto 4200
```

### Base de Datos

```bash
# Crear la BD desde el script
mysql -u root -p < bd/db_script.sql
```

## 📦 Estructura de Carpetas - Convenciones

### Backend (src/)
- **config/**: Variables de entorno, conexión BD
- **controllers/**: Manejadores de requests HTTP
- **services/**: Lógica de negocio (acceso a BD, cálculos, etc)
- **models/**: DTOs, interfaces, tipos de entidades
- **routes/**: Definición de rutas Express
- **middleware/**: Auth, validación, manejo de errores
- **validators/**: Validadores con express-validator
- **types/**: Tipos globales de TypeScript
- **utils/**: Funciones auxiliares reutilizables
- **helpers/**: Métodos helper específicos de dominio
- **errors/**: Clases de error personalizadas
- **db/**: Conexión a MySQL, migraciones

### Frontend (src/app/)
- **core/**: Servicios singleton, guards, interceptors
- **shared/**: Componentes, pipes, directivas reutilizables
- **features/**: Módulos por funcionalidad (lazy loaded)
  - Cada feature puede tener: components/, services/, models/, guards/

## 🔐 Seguridad

- JWT para autenticación
- CORS configurado
- Helmet para headers de seguridad
- Validación de entrada en backend
- Encriptación de contraseñas con bcryptjs
- Logs de acceso a datos sensibles

## 📊 Funcionalidades Principales

1. **Autenticación y Autorización**
   - Roles: Paciente, Profesional, Admin

2. **Gestión de Perfiles**
   - Perfil de paciente (historial, documentos)
   - Perfil de profesional (especialidades, licencia)

3. **Teleconsultas**
   - Chat en tiempo real
   - Video conferencia
   - Historial de consultas

4. **Documentos Médicos**
   - Carga y almacenamiento
   - Análisis con IA (clasificación, extracción de entidades)

5. **Medicación**
   - Planes de medicación
   - Recordatorios automáticos

6. **Reportes**
   - Generación de PDF con firma digital

7. **Análisis de Riesgo**
   - Evaluación temprana basada en hábitos y datos
   - Recomendaciones personalizadas

## 🤝 Contribuir

Para cualquier cambio en la estructura, por favor actualizar este README.

## 📝 Licencia

ISC
