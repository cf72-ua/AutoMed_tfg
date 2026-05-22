import { Router, Request, Response } from "express";
import { Server } from "socket.io";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { TeleconsultationService } from "../services/teleconsultation.service";
import { TeleconsultationSummaryService } from "../services/teleconsultation-summary.service";

const router = Router();
const teleconsultationService = new TeleconsultationService();
const teleconsultationSummaryService = new TeleconsultationSummaryService();

router.use(authenticateJWT);

router.get(
  "/doctors",
  requireRole(["PACIENTE", "DOCTOR"]),
  async (_req: Request, res: Response) => {
    try {
      const doctors = await teleconsultationService.listDoctors();
      res.json(doctors);
    } catch (error) {
      console.error("Error in GET /teleconsultations/doctors", error);
      res.status(500).json({ error: "Failed to fetch doctors" });
    }
  },
);

router.get(
  "/",
  requireRole(["PACIENTE", "DOCTOR"]),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const consultations = await teleconsultationService.listForUser(userId);
      res.json(consultations);
    } catch (error) {
      console.error("Error in GET /teleconsultations", error);
      res.status(500).json({ error: "Failed to fetch teleconsultations" });
    }
  },
);

router.post(
  "/",
  requireRole(["PACIENTE", "DOCTOR"]),
  async (req: Request, res: Response) => {
    try {
      const patientId = Number(req.body.patientId);
      const professionalId = req.body.professionalId
        ? Number(req.body.professionalId)
        : undefined;
      const doctorUserId = req.body.doctorUserId
        ? Number(req.body.doctorUserId)
        : undefined;

      if (!Number.isFinite(patientId) || patientId <= 0) {
        return res.status(400).json({ error: "Invalid patientId" });
      }

      if (!professionalId && !doctorUserId) {
        return res
          .status(400)
          .json({ error: "professionalId or doctorUserId is required" });
      }

      const consultation = await teleconsultationService.create(
        {
          patientId,
          professionalId,
          doctorUserId,
          purpose: req.body.purpose,
        },
        req.user!.id,
        req.user!.roles as string[],
      );

      res.status(201).json(consultation);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Error in POST /teleconsultations", message);
      res.status(400).json({ error: message });
    }
  },
);

router.get(
  "/:consultationId/messages",
  requireRole(["PACIENTE", "DOCTOR"]),
  async (req: Request, res: Response) => {
    try {
      const consultationId = Number(req.params.consultationId);
      if (!Number.isFinite(consultationId) || consultationId <= 0) {
        return res.status(400).json({ error: "Invalid consultationId" });
      }

      const messages = await teleconsultationService.getMessages(
        consultationId,
        req.user!.id,
      );
      res.json(messages);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Error in GET /teleconsultations/:id/messages", message);
      res.status(403).json({ error: message });
    }
  },
);

router.post(
  "/:consultationId/messages",
  requireRole(["PACIENTE", "DOCTOR"]),
  async (req: Request, res: Response) => {
    try {
      const consultationId = Number(req.params.consultationId);
      if (!Number.isFinite(consultationId) || consultationId <= 0) {
        return res.status(400).json({ error: "Invalid consultationId" });
      }

      const message = await teleconsultationService.createMessage(
        consultationId,
        req.user!.id,
        req.body.content,
        req.body.type || "text",
      );
      res.status(201).json(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Error in POST /teleconsultations/:id/messages", message);
      res.status(400).json({ error: message });
    }
  },
);

router.post(
  "/:consultationId/summary/pdf",
  requireRole(["PACIENTE", "DOCTOR"]),
  async (req: Request, res: Response) => {
    try {
      const consultationId = Number(req.params.consultationId);
      if (!Number.isFinite(consultationId) || consultationId <= 0) {
        return res.status(400).json({ error: "Invalid consultationId" });
      }

      const pdf = await teleconsultationSummaryService.generatePdf(
        consultationId,
        req.user!.id,
      );

      res.download(pdf.absolutePath, pdf.fileName);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(
        "Error in POST /teleconsultations/:id/summary/pdf",
        message,
      );
      res.status(400).json({ error: message });
    }
  },
);

router.put(
  "/:consultationId/close",
  requireRole(["DOCTOR"]),
  async (req: Request, res: Response) => {
    try {
      const consultationId = Number(req.params.consultationId);
      if (!Number.isFinite(consultationId) || consultationId <= 0) {
        return res.status(400).json({ error: "Invalid consultationId" });
      }

      const consultation = await teleconsultationService.close(
        consultationId,
        req.user!.id,
      );
      const io = req.app.get("io") as Server | undefined;
      io?.of("/teleconsultations")
        .to(`consultation:${consultationId}`)
        .emit("consultation_closed", consultation);

      res.json(consultation);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Error in PUT /teleconsultations/:id/close", message);
      res.status(400).json({ error: message });
    }
  },
);

export default router;
