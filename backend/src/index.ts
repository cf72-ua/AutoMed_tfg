import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import path from 'path';
import { Server } from 'socket.io';
import { initializeDatabase } from './db/connection';
import { registerTeleconsultationSocket } from './sockets/teleconsultation.socket';

// Cargar variables de entorno
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:4200';

// Middleware de seguridad y parsing
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: corsOrigin,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/signatures', express.static(path.join(process.cwd(), '../storage/signatures'), {
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'Server is running', timestamp: new Date() });
});

// Rutas - se cargarán después de inicializar la BD

// Middleware de manejo de errores global
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 Handler - se registrará después de las rutas

// Inicializar base de datos e iniciar servidor
async function startServer() {
  try {
    await initializeDatabase();
    const httpServer = createServer(app);
    const io = new Server(httpServer, {
      cors: {
        origin: corsOrigin,
        credentials: true
      }
    });
    app.set('io', io);
    registerTeleconsultationSocket(io);
    
    // Importar y registrar rutas DESPUÉS de inicializar la BD
    const authRouter = (await import('./routes/auth.routes')).default;
    const appointmentsRouter = (await import('./routes/appointments.routes')).default;
    const medicationsRouter = (await import('./routes/medications.routes')).default;
    const habitsRouter = (await import('./routes/habits.routes')).default;
    const reportsRouter = (await import('./routes/reports.routes')).default;
    const teleconsultationRouter = (await import('./routes/teleconsultation.routes')).default;
    const patientProfilesRouter = (await import('./routes/patient-profiles.routes')).default;
    const professionalProfilesRouter = (await import('./routes/professional-profiles.routes')).default;
    const usersRouter = (await import('./routes/users.routes')).default;
    const adminRouter = (await import('./routes/admin.routes')).default;

    app.use('/api/auth', authRouter);
    app.use('/api/appointments', appointmentsRouter);
    app.use('/api/medications', medicationsRouter);
    app.use('/api/habits', habitsRouter);
    app.use('/api/teleconsultations', teleconsultationRouter);
    app.use('/api/patient-profiles', patientProfilesRouter);
    app.use('/api/professional-profiles', professionalProfilesRouter);
    app.use('/api/users', usersRouter);
    app.use('/api/admin', adminRouter);
    app.use('/api', reportsRouter);
    
    // 404 Handler - debe estar al final
    app.use((req: Request, res: Response) => {
      res.status(404).json({ message: 'Route not found' });
    });
    
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
