import express, { Request, Response, Router } from "express";
import { getDatabase } from "../db/connection";
import { authenticateJWT } from "../middleware/auth.middleware";

const router: Router = express.Router();

router.use(authenticateJWT);

/**
 * GET /api/patient-profiles/me
 * Obtener el perfil de paciente del usuario autenticado.
 */
router.get("/me", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const db = getDatabase();
    const [rows]: any = await db.query(
      `SELECT
        pp.id,
        pp.user_id as userId,
        u.dni,
        u.email,
        u.full_name as fullName,
        u.phone,
        u.status,
        pp.birth_date as birthDate,
        pp.sex,
        pp.notes,
        pp.chronic_flags as chronicFlags,
        pp.created_at as createdAt,
        pp.updated_at as updatedAt
      FROM patient_profiles pp
      INNER JOIN users u ON pp.user_id = u.id
      WHERE pp.user_id = ?
      LIMIT 1`,
      [userId],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Perfil de paciente no encontrado" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error in GET /patient-profiles/me", error);
    res.status(500).json({ error: "Failed to fetch patient profile" });
  }
});

/**
 * GET /api/patient-profiles/:id
 * Obtener un perfil de paciente por id de perfil.
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const patientId = parseInt(req.params.id, 10);
    if (isNaN(patientId)) {
      return res.status(400).json({ error: "Invalid patient profile id" });
    }

    const db = getDatabase();
    const [rows]: any = await db.query(
      `SELECT
        pp.id,
        pp.user_id as userId,
        u.dni,
        u.email,
        u.full_name as fullName,
        u.phone,
        u.status,
        pp.birth_date as birthDate,
        pp.sex,
        pp.notes,
        pp.chronic_flags as chronicFlags,
        pp.created_at as createdAt,
        pp.updated_at as updatedAt
      FROM patient_profiles pp
      INNER JOIN users u ON pp.user_id = u.id
      WHERE pp.id = ?
      LIMIT 1`,
      [patientId],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Perfil de paciente no encontrado" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error in GET /patient-profiles/:id", error);
    res.status(500).json({ error: "Failed to fetch patient profile" });
  }
});

export default router;
