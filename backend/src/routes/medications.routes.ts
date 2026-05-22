/**
 * Rutas de Alarmas de Medicación
 */

import express, { Request, Response, Router } from "express";
import {
  MedicationsService,
  CreateMedicationAlarmDto,
} from "../services/medications.service";

const router: Router = express.Router();
const medicationsService = new MedicationsService();

/**
 * GET /api/medications/:patientId
 * Obtener todas las alarmas de medicación de un paciente
 */
router.get("/:patientId", async (req: Request, res: Response) => {
  try {
    const patientId = parseInt(req.params.patientId);

    if (isNaN(patientId)) {
      return res.status(400).json({ error: "Invalid patientId" });
    }

    const alarms =
      await medicationsService.getMedicationAlarmsByPatient(patientId);
    res.json(alarms);
  } catch (error) {
    console.error("Error in GET /medications/:patientId", error);
    res.status(500).json({ error: "Failed to fetch medication alarms" });
  }
});

/**
 * POST /api/medications
 * Crear una nueva alarma de medicación
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { patientId, medicationName, dose, frequency, time, endDate, notes } =
      req.body;

    if (
      !patientId ||
      !medicationName ||
      !dose ||
      !frequency ||
      !time ||
      !endDate
    ) {
      return res
        .status(400)
        .json({
          error:
            "Missing required fields: patientId, medicationName, dose, frequency, time, endDate",
        });
    }

    const createDto: CreateMedicationAlarmDto = {
      patientId,
      medicationName,
      dose,
      frequency,
      time,
      endDate,
      notes,
    };

    const alarm = await medicationsService.createMedicationAlarm(createDto);
    res.status(201).json(alarm);
  } catch (error) {
    console.error("Error in POST /medications", error);
    res.status(500).json({ error: "Failed to create medication alarm" });
  }
});

/**
 * PUT /api/medications/:alarmId
 * Actualizar una alarma de medicación
 */
router.put("/:alarmId", async (req: Request, res: Response) => {
  try {
    const alarmId = parseInt(req.params.alarmId);

    if (isNaN(alarmId)) {
      return res.status(400).json({ error: "Invalid alarmId" });
    }

    const { medicationName, dose, frequency, time, endDate, notes } = req.body;

    const updateDto: Partial<CreateMedicationAlarmDto> = {
      medicationName,
      dose,
      frequency,
      time,
      endDate,
      notes,
    };

    const alarm = await medicationsService.updateMedicationAlarm(
      alarmId,
      updateDto,
    );
    res.json(alarm);
  } catch (error) {
    console.error("Error in PUT /medications/:alarmId", error);
    res.status(500).json({ error: "Failed to update medication alarm" });
  }
});

/**
 * DELETE /api/medications/:alarmId
 * Eliminar una alarma de medicación
 */
router.delete("/:alarmId", async (req: Request, res: Response) => {
  try {
    const alarmId = parseInt(req.params.alarmId);

    if (isNaN(alarmId)) {
      return res.status(400).json({ error: "Invalid alarmId" });
    }

    await medicationsService.deleteMedicationAlarm(alarmId);
    res.json({ message: "Medication alarm deleted successfully" });
  } catch (error) {
    console.error("Error in DELETE /medications/:alarmId", error);
    res.status(500).json({ error: "Failed to delete medication alarm" });
  }
});

export default router;
