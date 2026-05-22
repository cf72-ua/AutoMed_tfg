/**
 * Servicio de Reportes/Informes Médicos
 * Maneja CRUD, firma, generación de PDF y auditoría
 */

import { getDatabase } from "../db/connection";
import {
  CreateReportDTO,
  UpdateReportDTO,
  SignReportDTO,
  ReportResponse,
  ReportListResponse,
} from "../models/report.dto";
import { PDFGenerationService } from "./pdf-generation.service";
import { ReportAuditService } from "./report-audit.service";
import crypto from "crypto";

export class ReportService {
  private get db() {
    return getDatabase();
  }
  private pdfService = new PDFGenerationService();
  private auditService = new ReportAuditService();

  /**
   * Crear un nuevo informe en estado DRAFT
   */
  async createReport(
    patientId: number,
    userId: number,
    dto: CreateReportDTO,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ReportResponse> {
    const connection = await this.db.getConnection();
    try {
      const professionalId = await this.getUserProfessionalId(userId);
      if (!professionalId) {
        throw new Error(
          "Perfil profesional no encontrado para el usuario autenticado",
        );
      }

      const [result] = await connection.query(
        `INSERT INTO medical_reports 
        (report_type_id, patient_id, professional_id, consultation_id, title, body, metadata, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')`,
        [
          dto.reportTypeId,
          patientId,
          professionalId,
          dto.consultationId || null,
          dto.title,
          dto.body,
          dto.metadata ? JSON.stringify(dto.metadata) : null,
        ],
      );

      const reportId = (result as any).insertId;

      // Registrar en auditoría: creación del reporte
      await this.auditService.logAction(
        reportId,
        userId,
        "GENERATED",
        ipAddress,
        userAgent,
        "Reporte creado en estado borrador",
      );

      return this.getReportById(reportId);
    } finally {
      connection.release();
    }
  }

  /**
   * Obtener informe por ID
   */
  async getReportById(reportId: number): Promise<ReportResponse> {
    const connection = await this.db.getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT mr.*, rt.name as report_type_name
        FROM medical_reports mr
        JOIN report_types rt ON mr.report_type_id = rt.id
        WHERE mr.id = ?`,
        [reportId],
      );

      if ((rows as any[]).length === 0) {
        throw new Error(`Reporte no encontrado: ${reportId}`);
      }

      return this.mapRowToResponse((rows as any[])[0]);
    } finally {
      connection.release();
    }
  }

  /**
   * Actualizar informe (solo si está en estado DRAFT)
   */
  async updateReport(
    reportId: number,
    dto: UpdateReportDTO,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ReportResponse> {
    const connection = await this.db.getConnection();
    try {
      const professionalId = await this.getUserProfessionalId(userId);
      if (!professionalId) {
        throw new Error(
          "Perfil profesional no encontrado para el usuario autenticado",
        );
      }

      // Verificar que está en estado draft y que es el profesional propietario
      const report = await this.getReportById(reportId);
      if (report.status !== "draft") {
        throw new Error(
          "No se puede editar un informe que ya fue firmado o archivado",
        );
      }
      if (report.professionalId !== professionalId) {
        throw new Error("No tienes permiso para editar este informe");
      }

      // Guardar snapshot de la revisión anterior
      await this.createRevision(reportId, report);

      // Actualizar informe
      const updateFields: string[] = [];
      const values: any[] = [];

      if (dto.title !== undefined) {
        updateFields.push("title = ?");
        values.push(dto.title);
      }
      if (dto.body !== undefined) {
        updateFields.push("body = ?");
        values.push(dto.body);
      }
      if (dto.metadata !== undefined) {
        updateFields.push("metadata = ?");
        values.push(JSON.stringify(dto.metadata));
      }

      if (updateFields.length === 0) {
        return this.getReportById(reportId);
      }

      values.push(reportId);
      await connection.query(
        `UPDATE medical_reports SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values,
      );

      // Registrar en auditoría
      await this.auditService.logAction(
        reportId,
        userId,
        "GENERATED",
        ipAddress,
        userAgent,
        "Reporte actualizado (borrador)",
      );

      return this.getReportById(reportId);
    } finally {
      connection.release();
    }
  }

  /**
   * Firmar informe (genera PDF inmutable)
   */
  async signReport(
    reportId: number,
    userId: number,
    dto: SignReportDTO,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ReportResponse> {
    const connection = await this.db.getConnection();
    try {
      const professionalId = await this.getUserProfessionalId(userId);
      if (!professionalId) {
        throw new Error(
          "Perfil profesional no encontrado para el usuario autenticado",
        );
      }

      const report = await this.getReportById(reportId);

      // Validaciones
      if (report.professionalId !== professionalId) {
        throw new Error(
          "Solo el profesional propietario puede firmar el informe",
        );
      }
      if (report.status !== "draft") {
        throw new Error("Solo se pueden firmar informes en estado borrador");
      }

      // Obtener firma del profesional
      const signature = await this.getProfessionalSignature(dto.signatureId);
      if (!signature) {
        throw new Error("Firma no encontrada");
      }
      if (signature.professional_id !== professionalId) {
        throw new Error("La firma no pertenece al profesional autenticado");
      }

      // Guardar firma antes de generar PDF para que el template pueda incluirla
      await connection.query(
        `UPDATE medical_reports
        SET signature_id = ?,
            signed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [dto.signatureId, reportId],
      );

      let pdfResult: { pdfPath: string; fileName: string };
      try {
        // Generar PDF
        pdfResult = await this.pdfService.generateReportPDF(reportId);
      } catch (error) {
        await connection.query(
          `UPDATE medical_reports
          SET signature_id = NULL,
              signed_at = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
          [reportId],
        );
        throw error;
      }

      // Calcular hash del PDF
      const pdfHash = crypto
        .createHash("sha256")
        .update(pdfResult.pdfPath)
        .digest("hex");

      // Actualizar reporte: marcar como signed, guardar PDF, asociar firma
      await connection.query(
        `UPDATE medical_reports 
        SET status = 'signed',
            pdf_url = ?,
            pdf_hash = ?,
            pdf_generated_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [pdfResult.pdfPath, pdfHash, reportId],
      );

      // Registrar en auditoría
      await this.auditService.logAction(
        reportId,
        userId,
        "SIGNED",
        ipAddress,
        userAgent,
        "Reporte firmado y PDF generado",
      );

      return this.getReportById(reportId);
    } finally {
      connection.release();
    }
  }

  /**
   * Descargar informe (registra en auditoría)
   */
  async downloadReport(
    reportId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string> {
    const connection = await this.db.getConnection();
    try {
      const report = await this.getReportById(reportId);

      if (!report.pdfUrl) {
        throw new Error("Este informe aún no tiene PDF generado");
      }

      // Verificar permisos
      await this.verifyAccessPermission(reportId, userId, "DOWNLOAD");

      // Registrar auditoría
      await this.auditService.logAction(
        reportId,
        userId,
        "DOWNLOADED",
        ipAddress,
        userAgent,
        "PDF descargado",
      );

      return report.pdfUrl;
    } finally {
      connection.release();
    }
  }

  /**
   * Ver informe (registra en auditoría)
   */
  async viewReport(
    reportId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ReportResponse> {
    const report = await this.getReportById(reportId);

    // Verificar permisos
    await this.verifyAccessPermission(reportId, userId, "VIEW");

    // Registrar auditoría
    await this.auditService.logAction(
      reportId,
      userId,
      "VIEWED",
      ipAddress,
      userAgent,
      "Informe visualizado",
    );

    return report;
  }

  /**
   * Listar informes por paciente (con filtros)
   */
  async listReportsByPatient(
    patientId: number,
    userId: number,
    filters?: {
      status?: string;
      reportTypeId?: number;
      fromDate?: Date;
      toDate?: Date;
    },
  ): Promise<ReportListResponse[]> {
    const connection = await this.db.getConnection();
    try {
      let query = `
        SELECT mr.id, mr.report_type_id, mr.title, rt.name as report_type_name, mr.status,
               patient_user.full_name as patient_name,
               professional_user.full_name as professional_name,
               mr.created_at, mr.signed_at, mr.pdf_url
        FROM medical_reports mr
        JOIN report_types rt ON mr.report_type_id = rt.id
        JOIN professional_profiles pp ON mr.professional_id = pp.id
        JOIN users professional_user ON pp.user_id = professional_user.id
        JOIN patient_profiles patient_profile ON mr.patient_id = patient_profile.id
        JOIN users patient_user ON patient_profile.user_id = patient_user.id
        WHERE mr.patient_id = ?
      `;
      const params: any[] = [patientId];

      // Verificar permisos del usuario
      const [userRole] = await connection.query(
        `SELECT r.name FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = ? LIMIT 1`,
        [userId],
      );

      const roleRows = userRole as any[];
      const userRoleName = roleRows.length > 0 ? roleRows[0].name : null;

      // Si el usuario es paciente, solo puede ver sus propios informes
      const userPatientId = await this.getUserPatientId(userId);
      if (userRoleName === "PACIENTE" && userPatientId !== patientId) {
        return [];
      }

      if (filters?.status) {
        query += " AND mr.status = ?";
        params.push(filters.status);
      }

      if (filters?.reportTypeId) {
        query += " AND mr.report_type_id = ?";
        params.push(filters.reportTypeId);
      }

      if (filters?.fromDate) {
        query += " AND mr.created_at >= ?";
        params.push(filters.fromDate);
      }

      if (filters?.toDate) {
        query += " AND mr.created_at <= ?";
        params.push(filters.toDate);
      }

      query += " ORDER BY mr.created_at DESC";

      const [rows] = await connection.query(query, params);
      return (rows as any[]).map((row) => ({
        id: row.id,
        reportTypeId: row.report_type_id,
        title: row.title,
        reportTypeName: row.report_type_name,
        status: row.status,
        patientName: row.patient_name,
        professionalName: row.professional_name,
        createdAt: row.created_at,
        signedAt: row.signed_at,
        pdfUrl: row.pdf_url,
      }));
    } finally {
      connection.release();
    }
  }

  /**
   * Listar informes visibles para el usuario autenticado
   */
  async listReportsForUser(
    userId: number,
    filters?: {
      status?: string;
      reportTypeId?: number;
      fromDate?: Date;
      toDate?: Date;
    },
  ): Promise<ReportListResponse[]> {
    const connection = await this.db.getConnection();
    try {
      const [roleRows] = await connection.query(
        `SELECT r.name FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = ?`,
        [userId],
      );

      const roles = (roleRows as any[]).map((row) => row.name);
      const isAdmin = roles.includes("ADMIN");
      const professionalId = await this.getUserProfessionalId(userId);
      const patientId = await this.getUserPatientId(userId);

      let query = `
        SELECT mr.id, mr.report_type_id, mr.title, rt.name as report_type_name, mr.status,
               patient_user.full_name as patient_name,
               professional_user.full_name as professional_name,
               mr.created_at, mr.signed_at, mr.pdf_url
        FROM medical_reports mr
        JOIN report_types rt ON mr.report_type_id = rt.id
        JOIN professional_profiles pp ON mr.professional_id = pp.id
        JOIN users professional_user ON pp.user_id = professional_user.id
        JOIN patient_profiles patient_profile ON mr.patient_id = patient_profile.id
        JOIN users patient_user ON patient_profile.user_id = patient_user.id
        WHERE 1 = 1
      `;
      const params: any[] = [];

      if (!isAdmin) {
        if (professionalId) {
          query += " AND mr.professional_id = ?";
          params.push(professionalId);
        } else if (patientId) {
          query += " AND mr.patient_id = ?";
          params.push(patientId);
        } else {
          return [];
        }
      }

      if (filters?.status) {
        query += " AND mr.status = ?";
        params.push(filters.status);
      }

      if (filters?.reportTypeId) {
        query += " AND mr.report_type_id = ?";
        params.push(filters.reportTypeId);
      }

      if (filters?.fromDate) {
        query += " AND mr.created_at >= ?";
        params.push(filters.fromDate);
      }

      if (filters?.toDate) {
        query += " AND mr.created_at <= ?";
        params.push(filters.toDate);
      }

      query += " ORDER BY mr.created_at DESC";

      const [rows] = await connection.query(query, params);
      return (rows as any[]).map((row) => ({
        id: row.id,
        reportTypeId: row.report_type_id,
        title: row.title,
        reportTypeName: row.report_type_name,
        status: row.status,
        patientName: row.patient_name,
        professionalName: row.professional_name,
        createdAt: row.created_at,
        signedAt: row.signed_at,
        pdfUrl: row.pdf_url,
      }));
    } finally {
      connection.release();
    }
  }

  /**
   * Listar tipos de informe disponibles
   */
  async listReportTypes() {
    const connection = await this.db.getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT id, name, slug, description, template_name, required_fields
        FROM report_types
        ORDER BY name`,
      );

      return (rows as any[]).map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        templateName: row.template_name,
        requiredFields:
          typeof row.required_fields === "string"
            ? JSON.parse(row.required_fields || "[]")
            : row.required_fields || [],
      }));
    } finally {
      connection.release();
    }
  }

  /**
   * Crear revisión (snapshot de cambios)
   */
  private async createRevision(
    reportId: number,
    report: ReportResponse,
  ): Promise<void> {
    const connection = await this.db.getConnection();
    try {
      // Obtener número de revisión actual
      const [counts] = await connection.query(
        "SELECT COUNT(*) as count FROM report_revisions WHERE report_id = ?",
        [reportId],
      );
      const revisionNumber = ((counts as any[])[0]?.count || 0) + 1;

      await connection.query(
        `INSERT INTO report_revisions (report_id, revision_number, body_snapshot, metadata_snapshot, status_at_revision)
        VALUES (?, ?, ?, ?, ?)`,
        [
          reportId,
          revisionNumber,
          report.body,
          report.metadata ? JSON.stringify(report.metadata) : null,
          report.status,
        ],
      );
    } finally {
      connection.release();
    }
  }

  /**
   * Obtener firma del profesional
   */
  async getProfessionalSignature(signatureId: number): Promise<any> {
    const connection = await this.db.getConnection();
    try {
      const [rows] = await connection.query(
        "SELECT * FROM professional_signatures WHERE id = ? AND is_active = TRUE",
        [signatureId],
      );
      return (rows as any[])[0] || null;
    } finally {
      connection.release();
    }
  }

  /**
   * Verificar permisos de acceso
   */
  private async verifyAccessPermission(
    reportId: number,
    userId: number,
    permissionType: string,
  ): Promise<void> {
    const connection = await this.db.getConnection();
    try {
      const report = await this.getReportById(reportId);

      // El paciente solo puede ver/descargar sus propios informes
      const userPatientId = await this.getUserPatientId(userId);
      if (userPatientId === report.patientId) {
        return;
      }

      // El profesional puede ver sus propios informes
      const userProfessionalId = await this.getUserProfessionalId(userId);
      if (userProfessionalId === report.professionalId) {
        return;
      }

      // Verificar permisos explícitos
      const [permissions] = await connection.query(
        `SELECT * FROM report_access_permissions 
        WHERE report_id = ? AND granted_to_user_id = ? AND permission_type = ?
        AND (expires_at IS NULL OR expires_at > NOW())`,
        [reportId, userId, permissionType],
      );

      if ((permissions as any[]).length === 0) {
        throw new Error("No tienes permisos para acceder a este informe");
      }
    } finally {
      connection.release();
    }
  }

  /**
   * Obtener ID del paciente del usuario
   */
  private async getUserPatientId(userId: number): Promise<number | null> {
    const connection = await this.db.getConnection();
    try {
      const [rows] = await connection.query(
        "SELECT id FROM patient_profiles WHERE user_id = ?",
        [userId],
      );
      return (rows as any[])[0]?.id || null;
    } finally {
      connection.release();
    }
  }

  /**
   * Obtener ID del perfil profesional del usuario
   */
  private async getUserProfessionalId(userId: number): Promise<number | null> {
    const connection = await this.db.getConnection();
    try {
      const [rows] = await connection.query(
        "SELECT id FROM professional_profiles WHERE user_id = ? LIMIT 1",
        [userId],
      );
      return (rows as any[])[0]?.id || null;
    } finally {
      connection.release();
    }
  }

  /**
   * Mapear fila a ReportResponse
   */
  private mapRowToResponse(row: any): ReportResponse {
    return {
      id: row.id,
      reportTypeId: row.report_type_id,
      reportTypeName: row.report_type_name,
      patientId: row.patient_id,
      professionalId: row.professional_id,
      consultationId: row.consultation_id,
      title: row.title,
      body: row.body,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      status: row.status,
      signatureId: row.signature_id,
      signedAt: row.signed_at,
      pdfUrl: row.pdf_url,
      pdfHash: row.pdf_hash,
      pdfGeneratedAt: row.pdf_generated_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
