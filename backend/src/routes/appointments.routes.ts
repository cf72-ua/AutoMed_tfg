/**
 * Rutas de Citas/Consultas
 */

import express, { Request, Response, Router } from "express";
import {
  AppointmentsService,
  CreateAppointmentDto,
} from "../services/appointments.service";

const router: Router = express.Router();
const appointmentsService = new AppointmentsService();

/**
 * GET /api/appointments/patients/all
 * Obtener todos los pacientes del sistema
 */
router.get("/patients/all", async (req: Request, res: Response) => {
  try {
    const patients = await appointmentsService.getAllPatients();
    res.json(patients);
  } catch (error) {
    console.error("Error in GET /appointments/patients/all", error);
    res.status(500).json({ error: "Failed to fetch patients" });
  }
});

/**
 * GET /api/appointments/doctor/:doctorId/patients
 * Obtener todos los pacientes que ha atendido un doctor
 */
router.get(
  "/doctor/:doctorId/patients",
  async (req: Request, res: Response) => {
    try {
      const doctorId = parseInt(req.params.doctorId);

      if (isNaN(doctorId)) {
        return res.status(400).json({ error: "Invalid doctorId" });
      }

      const patients = await appointmentsService.getPatientsByDoctor(doctorId);
      res.json(patients);
    } catch (error) {
      console.error(
        "Error in GET /appointments/doctor/:doctorId/patients",
        error,
      );
      res.status(500).json({ error: "Failed to fetch doctor patients" });
    }
  },
);

/**
 * GET /api/appointments/doctor/:doctorId
 * Obtener todas las citas de un doctor
 */
router.get("/doctor/:doctorId", async (req: Request, res: Response) => {
  try {
    const doctorId = parseInt(req.params.doctorId);

    if (isNaN(doctorId)) {
      return res.status(400).json({ error: "Invalid doctorId" });
    }

    const appointments =
      await appointmentsService.getAppointmentsByDoctor(doctorId);
    res.json(appointments);
  } catch (error) {
    console.error("Error in GET /appointments/doctor/:doctorId", error);
    res.status(500).json({ error: "Failed to fetch doctor appointments" });
  }
});

/**
 * GET /api/appointments/doctor/:doctorId/patient/:patientId
 * Obtener citas de un doctor para un paciente específico
 */
router.get(
  "/doctor/:doctorId/patient/:patientId",
  async (req: Request, res: Response) => {
    try {
      const doctorId = parseInt(req.params.doctorId);
      const patientId = parseInt(req.params.patientId);

      if (isNaN(doctorId) || isNaN(patientId)) {
        return res.status(400).json({ error: "Invalid doctorId or patientId" });
      }

      const appointments =
        await appointmentsService.getAppointmentsByDoctorAndPatient(
          doctorId,
          patientId,
        );
      res.json(appointments);
    } catch (error) {
      console.error(
        "Error in GET /appointments/doctor/:doctorId/patient/:patientId",
        error,
      );
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  },
);

/**
 * GET /api/appointments/:patientId
 * Obtener todas las citas de un paciente
 */
router.get("/:patientId", async (req: Request, res: Response) => {
  try {
    const patientId = parseInt(req.params.patientId);

    if (isNaN(patientId)) {
      return res.status(400).json({ error: "Invalid patientId" });
    }

    const appointments =
      await appointmentsService.getAppointmentsByPatient(patientId);
    res.json(appointments);
  } catch (error) {
    console.error("Error in GET /appointments/:patientId", error);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

/**
 * POST /api/appointments
 * Crear una nueva cita
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { patientId, doctorId, title, date, time, place, notes } = req.body;

    if (!patientId || !title || !date) {
      return res
        .status(400)
        .json({ error: "Missing required fields: patientId, title, date" });
    }

    const createDto: CreateAppointmentDto = {
      patientId,
      doctorId,
      title,
      date,
      time,
      place,
      notes,
    };

    const appointment = await appointmentsService.createAppointment(createDto);
    res.status(201).json(appointment);
  } catch (error) {
    console.error("Error in POST /appointments", error);
    res.status(500).json({ error: "Failed to create appointment" });
  }
});

/**
 * PUT /api/appointments/:appointmentId
 * Actualizar una cita
 */
router.put("/:appointmentId", async (req: Request, res: Response) => {
  try {
    const appointmentId = parseInt(req.params.appointmentId);

    if (isNaN(appointmentId)) {
      return res.status(400).json({ error: "Invalid appointmentId" });
    }

    const { title, date, time, place, notes } = req.body;

    const updateDto: Partial<CreateAppointmentDto> = {
      title,
      date,
      time,
      place,
      notes,
    };

    const appointment = await appointmentsService.updateAppointment(
      appointmentId,
      updateDto,
    );
    res.json(appointment);
  } catch (error) {
    console.error("Error in PUT /appointments/:appointmentId", error);
    res.status(500).json({ error: "Failed to update appointment" });
  }
});

/**
 * DELETE /api/appointments/:appointmentId
 * Eliminar una cita
 */
router.delete("/:appointmentId", async (req: Request, res: Response) => {
  try {
    const appointmentId = parseInt(req.params.appointmentId);

    if (isNaN(appointmentId)) {
      return res.status(400).json({ error: "Invalid appointmentId" });
    }

    await appointmentsService.deleteAppointment(appointmentId);
    res.json({ message: "Appointment deleted successfully" });
  } catch (error) {
    console.error("Error in DELETE /appointments/:appointmentId", error);
    res.status(500).json({ error: "Failed to delete appointment" });
  }
});

export default router;
