import express, { Request, Response, Router } from "express";
import { getDatabase } from "../db/connection";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
// @ts-ignore
import bcryptjs from "bcryptjs";

const router: Router = express.Router();

router.use(authenticateJWT);
router.use(requireRole(["ADMIN"]));

type CatalogType = "medications" | "report-types" | "locations";

const catalogConfig: Record<
  CatalogType,
  {
    table: string;
    label: string;
    select: string;
    hasDetail?: boolean;
    hasRequiredFields?: boolean;
  }
> = {
  medications: {
    table: "medication_catalog",
    label: "Medicamento",
    select:
      "'medications' as categoryKey, 'Medicamento' as category, id, name, slug, description, NULL as detail, NULL as requiredFields, created_at as createdAt",
  },
  "report-types": {
    table: "report_types",
    label: "Tipo de informe",
    select:
      "'report-types' as categoryKey, 'Tipo de informe' as category, id, name, slug, description, template_name as detail, required_fields as requiredFields, created_at as createdAt",
    hasDetail: true,
    hasRequiredFields: true,
  },
  locations: {
    table: "appointment_locations",
    label: "Ubicación",
    select:
      "'locations' as categoryKey, 'Ubicación' as category, id, name, slug, description, NULL as detail, NULL as requiredFields, created_at as createdAt",
  },
};

function getCatalogType(value: string): CatalogType | null {
  return value === "medications" ||
    value === "report-types" ||
    value === "locations"
    ? value
    : null;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseRequiredFields(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((field) => field.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((field) => field.trim()).filter(Boolean);
      }
    } catch {
      return trimmed
        .split(",")
        .map((field) => field.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function mapCatalogRows(rows: any[]) {
  return rows.map((row) => ({
    ...row,
    requiredFields:
      typeof row.requiredFields === "string"
        ? JSON.parse(row.requiredFields || "[]")
        : row.requiredFields || [],
  }));
}

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

router.post("/patients", async (req: Request, res: Response) => {
  const db = getDatabase();
  const connection = await db.getConnection();

  try {
    const dni = String(req.body.dni || "").trim();
    const password = String(req.body.password || "").trim();
    const fullName = String(req.body.fullName || "").trim();
    const email = req.body.email ? String(req.body.email).trim() : null;
    const phone = req.body.phone ? String(req.body.phone).trim() : null;
    const birthDate = req.body.birthDate
      ? String(req.body.birthDate).trim()
      : null;
    const sex = req.body.sex ? String(req.body.sex).trim() : null;

    if (!dni || !password || !fullName) {
      res.status(400).json({
        error: "DNI, contraseña y nombre completo son requeridos",
      });
      return;
    }

    await connection.beginTransaction();

    const [existingUsers]: any = await connection.query(
      "SELECT id FROM users WHERE dni = ?",
      [dni],
    );

    if (existingUsers.length > 0) {
      await connection.rollback();
      res.status(409).json({ error: "El DNI ya está registrado" });
      return;
    }

    const hashedPassword = await bcryptjs.hash(password, 10);
    const [userResult]: any = await connection.query(
      `INSERT INTO users (dni, password_hash, full_name, email, phone, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [dni, hashedPassword, fullName, email, phone],
    );

    const userId = userResult.insertId;
    const [roles]: any = await connection.query(
      "SELECT id FROM roles WHERE name = 'PACIENTE'",
    );

    let roleId = roles[0]?.id;
    if (!roleId) {
      const [roleResult]: any = await connection.query(
        "INSERT INTO roles (name) VALUES ('PACIENTE')",
      );
      roleId = roleResult.insertId;
    }

    await connection.query(
      "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
      [userId, roleId],
    );

    const [profileResult]: any = await connection.query(
      `INSERT INTO patient_profiles (user_id, birth_date, sex)
       VALUES (?, ?, ?)`,
      [userId, birthDate || null, sex || null],
    );

    await connection.commit();

    res.status(201).json({
      patientProfileId: profileResult.insertId,
      userId,
      fullName,
      dni,
      email,
      phone,
      status: "active",
      birthDate,
      sex,
      appointmentCount: 0,
      habitCount: 0,
      reportCount: 0,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error in POST /admin/patients", error);
    res.status(500).json({ error: "Failed to create patient" });
  } finally {
    connection.release();
  }
});

router.patch("/patients/:userId/status", async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    const status = String(req.body.status || "").trim();

    if (!userId || !["active", "inactive"].includes(status)) {
      res.status(400).json({ error: "Invalid userId or status" });
      return;
    }

    const db = getDatabase();
    const [result]: any = await db.query(
      `UPDATE users u
       JOIN user_roles ur ON u.id = ur.user_id
       JOIN roles r ON ur.role_id = r.id
       SET u.status = ?
       WHERE u.id = ? AND r.name = 'PACIENTE'`,
      [status, userId],
    );

    if (!result.affectedRows) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    res.json({ userId, status });
  } catch (error) {
    console.error("Error in PATCH /admin/patients/:userId/status", error);
    res.status(500).json({ error: "Failed to update patient status" });
  }
});

router.delete("/patients/:userId", async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);

    if (!userId) {
      res.status(400).json({ error: "Invalid userId" });
      return;
    }

    const db = getDatabase();
    const [result]: any = await db.query(
      `DELETE u FROM users u
       JOIN user_roles ur ON u.id = ur.user_id
       JOIN roles r ON ur.role_id = r.id
       WHERE u.id = ? AND r.name = 'PACIENTE'`,
      [userId],
    );

    if (!result.affectedRows) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    res.json({ message: "Patient deleted" });
  } catch (error: any) {
    console.error("Error in DELETE /admin/patients/:userId", error);
    res.status(error?.code === "ER_ROW_IS_REFERENCED_2" ? 409 : 500).json({
      error:
        error?.code === "ER_ROW_IS_REFERENCED_2"
          ? "Patient has related records and cannot be deleted"
          : "Failed to delete patient",
    });
  }
});

router.get("/catalog", async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const [rows]: any = await db.query(
      `SELECT ${catalogConfig["report-types"].select}
       FROM report_types
       UNION ALL
       SELECT ${catalogConfig.medications.select}
       FROM medication_catalog
       UNION ALL
       SELECT ${catalogConfig.locations.select}
       FROM appointment_locations
       ORDER BY category, name`,
    );

    res.json(mapCatalogRows(rows));
  } catch (error) {
    console.error("Error in GET /admin/catalog", error);
    res.status(500).json({ error: "Failed to fetch catalog" });
  }
});

router.post("/catalog/:type", async (req: Request, res: Response) => {
  try {
    const type = getCatalogType(req.params.type);
    if (!type) {
      res.status(400).json({ error: "Invalid catalog type" });
      return;
    }

    const db = getDatabase();
    const config = catalogConfig[type];
    const name = String(req.body.name || "").trim();
    const slug = slugify(String(req.body.slug || name));
    const description = req.body.description
      ? String(req.body.description).trim()
      : null;

    if (!name || !slug) {
      res.status(400).json({ error: "Name and slug are required" });
      return;
    }

    let result: any;
    if (type === "report-types") {
      const templateName = String(req.body.detail || req.body.templateName || "").trim();
      if (!templateName) {
        res.status(400).json({ error: "Template name is required" });
        return;
      }

      [result] = await db.query(
        `INSERT INTO ${config.table} (name, slug, description, template_name, required_fields)
         VALUES (?, ?, ?, ?, ?)`,
        [
          name,
          slug,
          description,
          templateName,
          JSON.stringify(parseRequiredFields(req.body.requiredFields)),
        ],
      );
    } else {
      [result] = await db.query(
        `INSERT INTO ${config.table} (name, slug, description)
         VALUES (?, ?, ?)`,
        [name, slug, description],
      );
    }

    const [rows]: any = await db.query(
      `SELECT ${config.select} FROM ${config.table} WHERE id = ?`,
      [result.insertId],
    );
    res.status(201).json(mapCatalogRows(rows)[0]);
  } catch (error: any) {
    console.error("Error in POST /admin/catalog/:type", error);
    res.status(error?.code === "ER_DUP_ENTRY" ? 409 : 500).json({
      error:
        error?.code === "ER_DUP_ENTRY"
          ? "Catalog item already exists"
          : "Failed to create catalog item",
    });
  }
});

router.put("/catalog/:type/:id", async (req: Request, res: Response) => {
  try {
    const type = getCatalogType(req.params.type);
    const id = Number(req.params.id);
    if (!type || !id) {
      res.status(400).json({ error: "Invalid catalog type or id" });
      return;
    }

    const db = getDatabase();
    const config = catalogConfig[type];
    const name = String(req.body.name || "").trim();
    const slug = slugify(String(req.body.slug || name));
    const description = req.body.description
      ? String(req.body.description).trim()
      : null;

    if (!name || !slug) {
      res.status(400).json({ error: "Name and slug are required" });
      return;
    }

    if (type === "report-types") {
      const templateName = String(req.body.detail || req.body.templateName || "").trim();
      if (!templateName) {
        res.status(400).json({ error: "Template name is required" });
        return;
      }

      await db.query(
        `UPDATE ${config.table}
         SET name = ?, slug = ?, description = ?, template_name = ?, required_fields = ?
         WHERE id = ?`,
        [
          name,
          slug,
          description,
          templateName,
          JSON.stringify(parseRequiredFields(req.body.requiredFields)),
          id,
        ],
      );
    } else {
      await db.query(
        `UPDATE ${config.table}
         SET name = ?, slug = ?, description = ?
         WHERE id = ?`,
        [name, slug, description, id],
      );
    }

    const [rows]: any = await db.query(
      `SELECT ${config.select} FROM ${config.table} WHERE id = ?`,
      [id],
    );
    if (!rows.length) {
      res.status(404).json({ error: "Catalog item not found" });
      return;
    }

    res.json(mapCatalogRows(rows)[0]);
  } catch (error: any) {
    console.error("Error in PUT /admin/catalog/:type/:id", error);
    res.status(error?.code === "ER_DUP_ENTRY" ? 409 : 500).json({
      error:
        error?.code === "ER_DUP_ENTRY"
          ? "Catalog item already exists"
          : "Failed to update catalog item",
    });
  }
});

router.delete("/catalog/:type/:id", async (req: Request, res: Response) => {
  try {
    const type = getCatalogType(req.params.type);
    const id = Number(req.params.id);
    if (!type || !id) {
      res.status(400).json({ error: "Invalid catalog type or id" });
      return;
    }

    const db = getDatabase();
    const [result]: any = await db.query(
      `DELETE FROM ${catalogConfig[type].table} WHERE id = ?`,
      [id],
    );

    if (!result.affectedRows) {
      res.status(404).json({ error: "Catalog item not found" });
      return;
    }

    res.json({ message: "Catalog item deleted" });
  } catch (error: any) {
    console.error("Error in DELETE /admin/catalog/:type/:id", error);
    res.status(error?.code === "ER_ROW_IS_REFERENCED_2" ? 409 : 500).json({
      error:
        error?.code === "ER_ROW_IS_REFERENCED_2"
          ? "Catalog item is in use"
          : "Failed to delete catalog item",
    });
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
