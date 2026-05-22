/**
 * Controlador de Reportes/Informes Médicos
 * Endpoints para CRUD, firma, auditoría y descarga
 */

import { Request, Response } from "express";
import { ReportService } from "../services/report.service";
import { ReportAuditService } from "../services/report-audit.service";
import { ProfessionalSignatureService } from "../services/signature.service";
import {
  CreateReportDTO,
  UpdateReportDTO,
  SignReportDTO,
} from "../models/report.dto";
import { handleErrorResponse } from "../helpers/error.handler";
import * as fs from "fs";
import * as path from "path";

export class ReportController {
  private reportService = new ReportService();
  private auditService = new ReportAuditService();
  private signatureService = new ProfessionalSignatureService();

  /**
   * Crear nuevo informe (solo DOCTOR)
   */
  async createReport(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const patientId = req.body.patientId;
      const dto: CreateReportDTO = req.body;

      if (!userId) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      if (!patientId) {
        res.status(400).json({ error: "patientId requerido" });
        return;
      }

      // Obtener IP del cliente
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get("user-agent");

      const report = await this.reportService.createReport(
        patientId,
        userId,
        dto,
        ipAddress,
        userAgent,
      );

      res.status(201).json(report);
    } catch (error) {
      handleErrorResponse(res, error);
    }
  }

  /**
   * Listar informes visibles para el usuario autenticado
   */
  async listReports(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      const filters = {
        status: req.query.status as string,
        reportTypeId: req.query.reportTypeId
          ? parseInt(req.query.reportTypeId as string)
          : undefined,
        fromDate: req.query.fromDate
          ? new Date(req.query.fromDate as string)
          : undefined,
        toDate: req.query.toDate
          ? new Date(req.query.toDate as string)
          : undefined,
      };

      const reports = await this.reportService.listReportsForUser(
        userId,
        filters,
      );

      res.json(reports);
    } catch (error) {
      handleErrorResponse(res, error);
    }
  }

  /**
   * Listar tipos de informe disponibles
   */
  async listReportTypes(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      const reportTypes = await this.reportService.listReportTypes();

      res.json(reportTypes);
    } catch (error) {
      handleErrorResponse(res, error);
    }
  }

  /**
   * Obtener informe por ID
   */
  async getReport(req: Request, res: Response): Promise<void> {
    try {
      const reportId = parseInt(req.params.id);
      const userId = (req as any).user?.id;

      if (!reportId) {
        res.status(400).json({ error: "ID de reporte inválido" });
        return;
      }

      if (!userId) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      const report = await this.reportService.getReportById(reportId);

      await this.reportService.viewReport(
        reportId,
        userId,
        req.ip,
        req.get("user-agent"),
      );

      res.json(report);
    } catch (error) {
      handleErrorResponse(res, error);
    }
  }

  /**
   * Actualizar informe (DRAFT solo)
   */
  async updateReport(req: Request, res: Response): Promise<void> {
    try {
      const reportId = parseInt(req.params.id);
      const userId = (req as any).user?.id;
      const dto: UpdateReportDTO = req.body;

      if (!reportId) {
        res.status(400).json({ error: "ID de reporte inválido" });
        return;
      }

      if (!userId) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      const report = await this.reportService.updateReport(
        reportId,
        dto,
        userId,
        req.ip,
        req.get("user-agent"),
      );

      res.json(report);
    } catch (error) {
      handleErrorResponse(res, error);
    }
  }

  /**
   * Firmar informe y generar PDF
   */
  async signReport(req: Request, res: Response): Promise<void> {
    try {
      const reportId = parseInt(req.params.id);
      const userId = (req as any).user?.id;
      const dto: SignReportDTO = req.body;

      if (!reportId) {
        res.status(400).json({ error: "ID de reporte inválido" });
        return;
      }

      if (!userId) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      if (!dto.signatureId) {
        res.status(400).json({ error: "signatureId requerido" });
        return;
      }

      const report = await this.reportService.signReport(
        reportId,
        userId,
        dto,
        req.ip,
        req.get("user-agent"),
      );

      res.json(report);
    } catch (error) {
      handleErrorResponse(res, error);
    }
  }

  /**
   * Descargar PDF del informe
   */
  async downloadReportPDF(req: Request, res: Response): Promise<void> {
    try {
      const reportId = parseInt(req.params.id);
      const userId = (req as any).user?.id;

      if (!reportId) {
        res.status(400).json({ error: "ID de reporte inválido" });
        return;
      }

      if (!userId) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      const pdfPath = await this.reportService.downloadReport(
        reportId,
        userId,
        req.ip,
        req.get("user-agent"),
      );

      const relativePdfPath = pdfPath.replace(/^\/+/, "");
      const absolutePdfPath = path.join(
        process.cwd(),
        "../storage",
        relativePdfPath,
      );

      if (!fs.existsSync(absolutePdfPath)) {
        res.status(404).json({ error: "Archivo PDF no encontrado" });
        return;
      }

      res.download(absolutePdfPath, `report-${reportId}.pdf`);
    } catch (error) {
      handleErrorResponse(res, error);
    }
  }

  /**
   * Listar informes de un paciente
   */
  async listPatientReports(req: Request, res: Response): Promise<void> {
    try {
      const patientId = parseInt(req.params.patientId);
      const userId = (req as any).user?.id;

      if (!patientId) {
        res.status(400).json({ error: "ID de paciente inválido" });
        return;
      }

      if (!userId) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      const filters = {
        status: req.query.status as string,
        reportTypeId: req.query.reportTypeId
          ? parseInt(req.query.reportTypeId as string)
          : undefined,
        fromDate: req.query.fromDate
          ? new Date(req.query.fromDate as string)
          : undefined,
        toDate: req.query.toDate
          ? new Date(req.query.toDate as string)
          : undefined,
      };

      const reports = await this.reportService.listReportsByPatient(
        patientId,
        userId,
        filters,
      );

      res.json(reports);
    } catch (error) {
      handleErrorResponse(res, error);
    }
  }

  /**
   * Obtener historial de auditoría de un informe (ADMIN solo)
   */
  async getReportAuditLog(req: Request, res: Response): Promise<void> {
    try {
      const reportId = parseInt(req.params.id);
      const userRoles = (req as any).user?.roles || [];

      if (!reportId) {
        res.status(400).json({ error: "ID de reporte inválido" });
        return;
      }

      if (!userRoles.includes("ADMIN")) {
        res.status(403).json({ error: "Solo ADMIN puede ver auditoría" });
        return;
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const offset = req.query.offset
        ? parseInt(req.query.offset as string)
        : 0;

      const auditLog = await this.auditService.getReportAuditLog(
        reportId,
        limit,
        offset,
      );

      res.json(auditLog);
    } catch (error) {
      handleErrorResponse(res, error);
    }
  }

  /**
   * Obtener auditoría global (ADMIN solo)
   */
  async getGlobalAuditLog(req: Request, res: Response): Promise<void> {
    try {
      const userRoles = (req as any).user?.roles || [];

      if (!userRoles.includes("ADMIN")) {
        res
          .status(403)
          .json({ error: "Solo ADMIN puede ver auditoría global" });
        return;
      }

      const filters = {
        action: req.query.action as string,
        actorUserId: req.query.actorUserId
          ? parseInt(req.query.actorUserId as string)
          : undefined,
        fromDate: req.query.fromDate
          ? new Date(req.query.fromDate as string)
          : undefined,
        toDate: req.query.toDate
          ? new Date(req.query.toDate as string)
          : undefined,
      };

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const offset = req.query.offset
        ? parseInt(req.query.offset as string)
        : 0;

      const auditLog = await this.auditService.getGlobalAuditLog(
        filters,
        limit,
        offset,
      );

      res.json(auditLog);
    } catch (error) {
      handleErrorResponse(res, error);
    }
  }

  /**
   * Obtener estadísticas de acceso de informe
   */
  async getReportAccessStats(req: Request, res: Response): Promise<void> {
    try {
      const reportId = parseInt(req.params.id);

      if (!reportId) {
        res.status(400).json({ error: "ID de reporte inválido" });
        return;
      }

      const stats = await this.auditService.getReportAccessStats(reportId);

      res.json(stats);
    } catch (error) {
      handleErrorResponse(res, error);
    }
  }
}
