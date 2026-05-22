import express, { Request, Response, Router } from "express";
import { getDatabase } from "../db/connection";
import { authenticateJWT } from "../middleware/auth.middleware";

const router: Router = express.Router();

router.use(authenticateJWT);

/**
 * GET /api/users/me
 * Obtener datos básicos del usuario autenticado.
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
        u.id,
        u.dni,
        u.email,
        u.full_name as fullName,
        u.phone,
        u.status,
        u.created_at as createdAt,
        u.updated_at as updatedAt,
        GROUP_CONCAT(r.name) as roles
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.id = ?
      GROUP BY u.id
      LIMIT 1`,
      [userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const user = rows[0];
    res.json({
      ...user,
      roles: user.roles ? String(user.roles).split(",") : [],
    });
  } catch (error) {
    console.error("Error in GET /users/me", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
