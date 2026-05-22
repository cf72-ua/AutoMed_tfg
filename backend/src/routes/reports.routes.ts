/**
 * Rutas del módulo de Reportes/Informes Médicos
 */

import { Router, Request, Response } from "express";
import { ReportController } from "../controllers/reports.controller";
import {
  SignatureController,
  uploadSignature,
} from "../controllers/signatures.controller";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { getDatabase } from "../db/connection";

const router = Router();

// Instanciar controladores
const reportController = new ReportController();
const signatureController = new SignatureController();

/**
 * ========================
 * RUTAS PÚBLICAS (requieren autenticación)
 * ========================
 */

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateJWT);

/**
 * ========================
 * RUTAS DE PACIENTES
 * ========================
 */

/**
 * GET /api/patients - Obtener lista de pacientes para crear reportes
 */
router.get("/patients", async (req: Request, res: Response) => {
  try {
    const doctorId = (req as any).user?.id;

    if (!doctorId) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    // Obtener conexión a BD
    const db = getDatabase();
    const connection = await db.getConnection();

    try {
      // Query para obtener pacientes
      const [patients] = await connection.query(`
        SELECT DISTINCT
          pp.id,
          u.full_name as fullName,
          u.email,
          u.dni,
          pp.birth_date as dateOfBirth,
          u.phone
        FROM users u
        INNER JOIN patient_profiles pp ON u.id = pp.user_id
        INNER JOIN user_roles ur ON u.id = ur.user_id
        INNER JOIN roles r ON ur.role_id = r.id
        WHERE r.name = 'PACIENTE'
        ORDER BY u.full_name
        LIMIT 100
      `);

      console.log("Pacientes encontrados:", patients);
      res.json(patients);
    } finally {
      connection.release();
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching patients:", errorMessage);
    res.status(500).json({
      error: "Failed to fetch patients",
      details:
        process.env.NODE_ENV === "development" ? errorMessage : undefined,
    });
  }
});

/**
 * ========================
 * RUTAS DE REPORTES
 * ========================
 */

// POST /api/reports - Crear nuevo informe (DOCTOR solo)
router.post(
  "/reports",
  requireRole(["DOCTOR"]),
  (req: Request, res: Response) => reportController.createReport(req, res),
);

// GET /api/reports - Listar informes visibles para el usuario autenticado
router.get("/reports", (req: Request, res: Response) =>
  reportController.listReports(req, res),
);

// GET /api/report-types - Listar tipos de informe disponibles
router.get("/report-types", (req: Request, res: Response) =>
  reportController.listReportTypes(req, res),
);

// GET /api/reports/:id - Obtener informe por ID
router.get("/reports/:id", (req: Request, res: Response) =>
  reportController.getReport(req, res),
);

// PUT /api/reports/:id - Actualizar informe (DRAFT solo)
router.put(
  "/reports/:id",
  requireRole(["DOCTOR"]),
  (req: Request, res: Response) => reportController.updateReport(req, res),
);

// POST /api/reports/:id/sign - Firmar informe y generar PDF (DOCTOR solo)
router.post(
  "/reports/:id/sign",
  requireRole(["DOCTOR"]),
  (req: Request, res: Response) => reportController.signReport(req, res),
);

// GET /api/reports/:id/download - Descargar PDF del informe
router.get("/reports/:id/download", (req: Request, res: Response) =>
  reportController.downloadReportPDF(req, res),
);

// GET /api/patients/:patientId/reports - Listar informes de un paciente
router.get("/patients/:patientId/reports", (req: Request, res: Response) =>
  reportController.listPatientReports(req, res),
);

// GET /api/reports/:id/audit - Obtener auditoría de informe (ADMIN solo)
router.get(
  "/reports/:id/audit",
  requireRole(["ADMIN"]),
  (req: Request, res: Response) => reportController.getReportAuditLog(req, res),
);

// GET /api/reports/audit/global - Obtener auditoría global (ADMIN solo)
router.get(
  "/audit/global",
  requireRole(["ADMIN"]),
  (req: Request, res: Response) => reportController.getGlobalAuditLog(req, res),
);

// GET /api/reports/:id/stats - Obtener estadísticas de acceso
router.get("/reports/:id/stats", (req: Request, res: Response) =>
  reportController.getReportAccessStats(req, res),
);

/**
 * ========================
 * RUTAS DE FIRMAS DIGITALES
 * ========================
 */

// POST /api/signatures/upload - Subir nueva firma (DOCTOR solo)
router.post(
  "/signatures/upload",
  requireRole(["DOCTOR"]),
  uploadSignature.single("signature"),
  (req: Request, res: Response) =>
    signatureController.uploadSignature(req, res),
);

// GET /api/signatures - Listar firmas del profesional
router.get(
  "/signatures",
  requireRole(["DOCTOR"]),
  (req: Request, res: Response) => signatureController.listSignatures(req, res),
);

// GET /api/signatures/active - Obtener firma activa
router.get(
  "/signatures/active",
  requireRole(["DOCTOR"]),
  (req: Request, res: Response) =>
    signatureController.getActiveSignature(req, res),
);

// PUT /api/signatures/:signatureId/activate - Activar firma
router.put(
  "/signatures/:signatureId/activate",
  requireRole(["DOCTOR"]),
  (req: Request, res: Response) =>
    signatureController.activateSignature(req, res),
);

// DELETE /api/signatures/:signatureId - Eliminar firma
router.delete(
  "/signatures/:signatureId",
  requireRole(["DOCTOR"]),
  (req: Request, res: Response) =>
    signatureController.deleteSignature(req, res),
);

export default router;
