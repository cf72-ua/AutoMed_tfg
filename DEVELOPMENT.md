# Guía de Desarrollo - AutoMed

## 🏗️ Usando la Estructura

### Backend (Node.js / Express / TypeScript)

#### 1. Crear un nuevo endpoint

1. **Crear el DTO en** `src/models/`
```typescript
// src/models/example.dto.ts
export interface CreateExampleDto {
  name: string;
  description: string;
}
```

2. **Crear el Servicio en** `src/services/`
```typescript
// src/services/example.service.ts
import { query, execute } from '@db/connection';

export class ExampleService {
  async create(dto: CreateExampleDto) {
    const sql = 'INSERT INTO examples (name, description) VALUES (?, ?)';
    const result = await execute(sql, [dto.name, dto.description]);
    return result;
  }
}
```

3. **Crear el Controlador/Ruta en** `src/routes/`
```typescript
// src/routes/example.routes.ts
import { Router } from 'express';
import { ExampleService } from '@services/example.service';
import { authenticateJWT } from '@middleware/auth.middleware';

const router = Router();
const exampleService = new ExampleService();

router.post('/', authenticateJWT, async (req, res) => {
  try {
    const result = await exampleService.create(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error });
  }
});

export default router;
```

4. **Registrar la ruta en** `src/index.ts`
```typescript
import exampleRoutes from '@routes/example.routes';
app.use('/api/examples', exampleRoutes);
```

#### 2. Variables de entorno
- Copiar `.env.example` a `.env`
- Editar valores según tu entorno

#### 3. Ejecutar en desarrollo
```bash
npm run dev
```

---

### Frontend (Angular 17+)

#### 1. Crear un nuevo módulo de feature

```bash
# Generar el módulo con Angular CLI
ng generate module features/exemplo --routing
```

Estructura resultante:
```
src/app/features/exemplo/
├── exemplo.module.ts
├── exemplo-routing.module.ts
├── components/
│   ├── list/
│   │   ├── list.component.ts
│   │   ├── list.component.html
│   │   └── list.component.scss
│   └── detail/
│       └── detail.component.ts
├── services/
│   └── example.service.ts
└── models/
    └── example.model.ts
```

#### 2. Crear un servicio

```typescript
// src/app/features/exemplo/services/example.service.ts
import { Injectable } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ExampleService {
  constructor(private apiService: ApiService) {}

  getExamples(): Observable<any[]> {
    return this.apiService.get('/examples');
  }

  getExample(id: number): Observable<any> {
    return this.apiService.get(`/examples/${id}`);
  }

  createExample(data: any): Observable<any> {
    return this.apiService.post('/examples', data);
  }

  updateExample(id: number, data: any): Observable<any> {
    return this.apiService.put(`/examples/${id}`, data);
  }

  deleteExample(id: number): Observable<any> {
    return this.apiService.delete(`/examples/${id}`);
  }
}
```

#### 3. Crear un componente

```typescript
// src/app/features/exemplo/components/list/list.component.ts
import { Component, OnInit } from '@angular/core';
import { ExampleService } from '../../services/example.service';

@Component({
  selector: 'app-example-list',
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss']
})
export class ExampleListComponent implements OnInit {
  examples: any[] = [];
  loading = true;

  constructor(private exampleService: ExampleService) {}

  ngOnInit(): void {
    this.loadExamples();
  }

  loadExamples(): void {
    this.exampleService.getExamples().subscribe({
      next: (data) => {
        this.examples = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading examples', err);
        this.loading = false;
      }
    });
  }
}
```

#### 4. Proteger una ruta

```typescript
// src/app/app-routing.module.ts
import { AuthGuard } from '@core/guards/auth.guard';
import { RoleGuard } from '@core/guards/role.guard';

const routes: Routes = [
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN'] }
  }
];
```

---

## 📋 Convenciones

### Nombres de archivos
- **Componentes**: `feature.component.ts`
- **Servicios**: `feature.service.ts`
- **Modelos**: `feature.model.ts`
- **DTOs**: `feature.dto.ts`
- **Rutas**: `feature.routes.ts`

### Nombres de carpetas
- Usar kebab-case: `user-profile`, `auth-guard`
- Agrupar por dominio en features

### Nombres de variables
```typescript
// Backend
const userId: number = 1;
const userData: UserResponse = {};

// Frontend
examples$ = this.exampleService.getExamples();
isLoading$ = new BehaviorSubject<boolean>(false);
```

---

## 🔄 Flujo de Desarrollo Completo

### Desde la BD hasta la UI

1. **BD**: Definir tabla en `bd/db_script.sql`
2. **Backend**:
   - DTO en `src/models/`
   - Servicio en `src/services/`
   - Rutas en `src/routes/`
3. **Frontend**:
   - Modelo en `src/app/shared/models/`
   - Servicio en `src/app/features/xxxx/services/`
   - Componentes en `src/app/features/xxxx/components/`

---

## 🧪 Testing

### Backend
```bash
npm test
npm run test:watch
```

### Frontend
```bash
ng test
```

---

## 📦 Build & Deploy

### Backend
```bash
npm run build
npm start
```

### Frontend
```bash
ng build --configuration production
# Resultado en dist/automed-frontend/
```

---

## 🐛 Troubleshooting

### Base de datos no conecta
1. Verificar que MySQL está corriendo
2. Revisar variables en `.env`
3. Ejecutar: `mysql -u root -p < bd/db_script.sql`

### CORS errors
- Actualizar `CORS_ORIGIN` en `.env` del backend

### Token expirado en frontend
- El interceptor renovará automáticamente el token

---

## 📚 Recursos

- [Angular Docs](https://angular.io/docs)
- [Express Docs](https://expressjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [MySQL 8 Docs](https://dev.mysql.com/doc/)
