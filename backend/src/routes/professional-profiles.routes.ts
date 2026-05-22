import express, { Request, Response, Router } from "express";
import { getDatabase } from "../db/connection";
import { authenticateJWT } from "../middleware/auth.middleware";

const router: Router = express.Router();

router.use(authenticateJWT);

/**
 * GET /api/professional-profiles/me
 * Obtener el perfil profesional del usuario autenticado.
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
        pp.category_id as categoryId,
        pc.name as categoryName,
        pp.license_number as licenseNumber,
        pp.workplace,
        pp.created_at as createdAt,
        pp.updated_at as updatedAt
      FROM professional_profiles pp
      INNER JOIN users u ON pp.user_id = u.id
      LEFT JOIN professional_categories pc ON pp.category_id = pc.id
      WHERE pp.user_id = ?
      LIMIT 1`,
      [userId],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Perfil profesional no encontrado" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error in GET /professional-profiles/me", error);
    res.status(500).json({ error: "Failed to fetch professional profile" });
  }
});

/**
 * GET /api/professional-profiles/:id
 * Obtener un perfil profesional por id de perfil.
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const professionalId = parseInt(req.params.id, 10);
    if (isNaN(professionalId)) {
      return res.status(400).json({ error: "Invalid professional profile id" });
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
        pp.category_id as categoryId,
        pc.name as categoryName,
        pp.license_number as licenseNumber,
        pp.workplace,
        pp.created_at as createdAt,
        pp.updated_at as updatedAt
      FROM professional_profiles pp
      INNER JOIN users u ON pp.user_id = u.id
      LEFT JOIN professional_categories pc ON pp.category_id = pc.id
      WHERE pp.id = ?
      LIMIT 1`,
      [professionalId],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Perfil profesional no encontrado" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error in GET /professional-profiles/:id", error);
    res.status(500).json({ error: "Failed to fetch professional profile" });
  }
});

export default router;
