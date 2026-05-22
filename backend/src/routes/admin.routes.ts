import express, { Request, Response, Router } from "express";
import { getDatabase } from "../db/connection";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router: Router = express.Router();

router.use(authenticateJWT);
router.use(requireRole(["ADMIN"]));

router.get("/patients", async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const [rows]: any = await db.query(
      `SELECT
        pp.id as patientProfileId,
        u.id as userId,
        u.full_name as fullName,
        u.dni,
        u.email,
        u.phone,
        u.status,
        DATE_FORMAT(pp.birth_date, '%Y-%m-%d') as birthDate,
        pp.sex,
        COUNT(DISTINCT a.id) as appointmentCount,
        COUNT(DISTINCT h.id) as habitCount,
        COUNT(DISTINCT mr.id) as reportCount,
        u.created_at as createdAt
      FROM patient_profiles pp
      JOIN users u ON pp.user_id = u.id
      LEFT JOIN appointments a ON a.patient_id = pp.id
      LEFT JOIN habit_logs h ON h.patient_id = pp.id
      LEFT JOIN medical_reports mr ON mr.patient_id = pp.id
      GROUP BY pp.id, u.id
      ORDER BY u.full_name ASC`,
    );

    res.json(rows);
  } catch (error) {
    console.error("Error in GET /admin/patients", error);
    res.status(500).json({ error: "Failed to fetch patients" });
  }
});

router.get("/catalog", async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const [rows]: any = await db.query(
      `SELECT 'Tipo de informe' as category, id, name, slug, description, template_name as detail, created_at as createdAt
       FROM report_types
       UNION ALL
       SELECT 'Categoría profesional' as category, id, name, NULL as slug, description, NULL as detail, NULL as createdAt
       FROM professional_categories
       UNION ALL
       SELECT 'Especialidad' as category, s.id, s.name, NULL as slug, pc.name as description, NULL as detail, NULL as createdAt
       FROM specialties s
       LEFT JOIN professional_categories pc ON s.category_id = pc.id
       UNION ALL
       SELECT 'Tipo documental' as category, id, name, slug, description, NULL as detail, NULL as createdAt
       FROM document_types
       ORDER BY category, name`,
    );

    res.json(rows);
  } catch (error) {
    console.error("Error in GET /admin/catalog", error);
    res.status(500).json({ error: "Failed to fetch catalog" });
  }
});

router.get("/logs", async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const action = String(req.query.action || "");
    const params: any[] = [];
    let where = "WHERE 1 = 1";

    if (action) {
      where += " AND ra.action = ?";
      params.push(action);
    }

    const [rows]: any = await db.query(
      `SELECT
        ra.id,
        ra.report_id as reportId,
        mr.title as reportTitle,
        ra.actor_user_id as actorUserId,
        u.full_name as actorName,
        ra.action,
        ra.ip_address as ipAddress,
        ra.reason_notes as reasonNotes,
        ra.created_at as createdAt
      FROM report_access_audit ra
      JOIN medical_reports mr ON ra.report_id = mr.id
      JOIN users u ON ra.actor_user_id = u.id
      ${where}
      ORDER BY ra.created_at DESC
      LIMIT 200`,
      params,
    );

    res.json(rows);
  } catch (error) {
    console.error("Error in GET /admin/logs", error);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

export default router;
