/**
 * Rutas de Hábitos
 */

import express, { Request, Response, Router } from "express";
import { HabitsService, CreateHabitLogDto } from "../services/habits.service";

const router: Router = express.Router();
const habitsService = new HabitsService();

/**
 * GET /api/habits/:patientId
 * Obtener todos los hábitos de un paciente
 */
router.get("/:patientId", async (req: Request, res: Response) => {
  try {
    const patientId = parseInt(req.params.patientId);

    if (isNaN(patientId)) {
      return res.status(400).json({ error: "Invalid patientId" });
    }

    const habits = await habitsService.getHabitsByPatient(patientId);
    res.json(habits);
  } catch (error) {
    console.error("Error in GET /habits/:patientId", error);
    res.status(500).json({ error: "Failed to fetch habits" });
  }
});

/**
 * GET /api/habits/:patientId/type/:habitType
 * Obtener hábitos de un tipo específico para la última semana
 */
router.get(
  "/:patientId/type/:habitType",
  async (req: Request, res: Response) => {
    try {
      const patientId = parseInt(req.params.patientId);
      const habitType = req.params.habitType.toUpperCase();

      if (isNaN(patientId)) {
        return res.status(400).json({ error: "Invalid patientId" });
      }

      const today = new Date();
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const endDate = today.toISOString().split("T")[0];
      const startDate = sevenDaysAgo.toISOString().split("T")[0];

      const habits = await habitsService.getHabitsByType(
        patientId,
        habitType,
        startDate,
        endDate,
      );
      res.json(habits);
    } catch (error) {
      console.error("Error in GET /habits/:patientId/type/:habitType", error);
      res.status(500).json({ error: "Failed to fetch habits" });
    }
  },
);

/**
 * POST /api/habits
 * Crear un nuevo registro de hábito
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { patientId, habitType, value, notes, loggedDate } = req.body;
    const normalizedHabitType = String(habitType || "").toUpperCase();

    if (!patientId || !habitType || !loggedDate) {
      return res.status(400).json({
        error: "Missing required fields: patientId, habitType, loggedDate",
      });
    }

    if (normalizedHabitType !== "NUTRITION" && value === undefined) {
      return res.status(400).json({
        error: "Missing required field: value",
      });
    }

    const createDto: CreateHabitLogDto = {
      patientId,
      habitType: normalizedHabitType as CreateHabitLogDto["habitType"],
      value: value !== undefined ? parseFloat(value) : undefined,
      notes,
      loggedDate,
    };

    const habit = await habitsService.createHabitLog(createDto);
    res.status(201).json(habit);
  } catch (error) {
    console.error("Error in POST /habits", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to create habit log",
    });
  }
});

/**
 * PUT /api/habits/:habitId
 * Actualizar un registro de hábito
 */
router.put("/:habitId", async (req: Request, res: Response) => {
  try {
    const habitId = parseInt(req.params.habitId);

    if (isNaN(habitId)) {
      return res.status(400).json({ error: "Invalid habitId" });
    }

    const { value, notes, loggedDate } = req.body;

    const updateDto: Partial<CreateHabitLogDto> = {
      value: value !== undefined ? parseFloat(value) : undefined,
      notes,
      loggedDate,
    };

    const habit = await habitsService.updateHabitLog(habitId, updateDto);
    res.json(habit);
  } catch (error) {
    console.error("Error in PUT /habits/:habitId", error);
    res.status(500).json({ error: "Failed to update habit log" });
  }
});

/**
 * DELETE /api/habits/:habitId
 * Eliminar un registro de hábito
 */
router.delete("/:habitId", async (req: Request, res: Response) => {
  try {
    const habitId = parseInt(req.params.habitId);

    if (isNaN(habitId)) {
      return res.status(400).json({ error: "Invalid habitId" });
    }

    await habitsService.deleteHabitLog(habitId);
    res.json({ message: "Habit log deleted successfully" });
  } catch (error) {
    console.error("Error in DELETE /habits/:habitId", error);
    res.status(500).json({ error: "Failed to delete habit log" });
  }
});

/**
 * POST /api/habits/:patientId/recommendations
 * Generar recomendaciones personalizadas con IA
 */
router.post(
  "/:patientId/recommendations",
  async (req: Request, res: Response) => {
    try {
      const patientId = Number(req.params.patientId);
      if (!Number.isFinite(patientId) || patientId <= 0) {
        return res.status(400).json({ error: "Invalid patientId" });
      }

      const { AIRecommendationsService } =
        await import("../services/ai-recommendations.service");

      // ✅ Opción 2: el servicio se encarga de todo (BD + IA)
      const result =
        await AIRecommendationsService.generateFromPatientHabits(patientId);

      return res.json(result);
    } catch (error) {
      console.error("Error generating recommendations:", error);
      return res.status(500).json({
        error: "Failed to generate recommendations",
        details: String(error),
      });
    }
  },
);

export default router;
