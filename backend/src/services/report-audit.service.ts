/**
 * Servicio de Auditoría de Reportes
 * Registra todas las acciones sobre informes (visualización, descarga, firma, etc.)
 */

import { getDatabase } from "../db/connection";
import { ReportAccessAuditResponse } from "../models/report.dto";

export class ReportAuditService {
  private get db() {
    return getDatabase();
  }

  /**
   * Registrar una acción en la auditoría
   */
  async logAction(
    reportId: number,
    actorUserId: number,
    action: "VIEWED" | "DOWNLOADED" | "GENERATED" | "SIGNED" | "ARCHIVED",
    ipAddress?: string,
    userAgent?: string,
    reasonNotes?: string,
  ): Promise<void> {
    const connection = await this.db.getConnection();
    try {
      await connection.query(
        `INSERT INTO report_access_audit 
        (report_id, actor_user_id, action, ip_address, user_agent, reason_notes)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          reportId,
          actorUserId,
          action,
          ipAddress || null,
          userAgent || null,
          reasonNotes || null,
        ],
      );
    } finally {
      connection.release();
    }
  }

  /**
   * Obtener historial de auditoría de un reporte
   */
  async getReportAuditLog(
    reportId: number,
    limit: number = 100,
    offset: number = 0,
  ): Promise<ReportAccessAuditResponse[]> {
    const connection = await this.db.getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT ra.id, ra.report_id, ra.actor_user_id, u.full_name as actor_name,
                ra.action, ra.ip_address, ra.reason_notes, ra.created_at
        FROM report_access_audit ra
        JOIN users u ON ra.actor_user_id = u.id
        WHERE ra.report_id = ?
        ORDER BY ra.created_at DESC
        LIMIT ? OFFSET ?`,
        [reportId, limit, offset],
      );

      return (rows as any[]).map((row) => ({
        id: row.id,
        reportId: row.report_id,
        actorUserId: row.actor_user_id,
        actorName: row.actor_name,
        action: row.action,
        ipAddress: row.ip_address,
        reasonNotes: row.reason_notes,
        createdAt: row.created_at,
      }));
    } finally {
      connection.release();
    }
  }

  /**
   * Obtener historial de auditoría global (solo para ADMIN)
   */
  async getGlobalAuditLog(
    filters?: {
      action?: string;
      actorUserId?: number;
      fromDate?: Date;
      toDate?: Date;
    },
    limit: number = 100,
    offset: number = 0,
  ): Promise<any[]> {
    const connection = await this.db.getConnection();
    try {
      let query = `
        SELECT ra.id, ra.report_id, mr.title as report_title, ra.actor_user_id, 
               u.full_name as actor_name, ra.action, ra.ip_address, 
               ra.reason_notes, ra.created_at
        FROM report_access_audit ra
        JOIN medical_reports mr ON ra.report_id = mr.id
        JOIN users u ON ra.actor_user_id = u.id
        WHERE 1 = 1
      `;
      const params: any[] = [];

      if (filters?.action) {
        query += " AND ra.action = ?";
        params.push(filters.action);
      }

      if (filters?.actorUserId) {
        query += " AND ra.actor_user_id = ?";
        params.push(filters.actorUserId);
      }

      if (filters?.fromDate) {
        query += " AND ra.created_at >= ?";
        params.push(filters.fromDate);
      }

      if (filters?.toDate) {
        query += " AND ra.created_at <= ?";
        params.push(filters.toDate);
      }

      query += " ORDER BY ra.created_at DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const [rows] = await connection.query(query, params);

      return (rows as any[]).map((row) => ({
        id: row.id,
        reportId: row.report_id,
        reportTitle: row.report_title,
        actorUserId: row.actor_user_id,
        actorName: row.actor_name,
        action: row.action,
        ipAddress: row.ip_address,
        reasonNotes: row.reason_notes,
        createdAt: row.created_at,
      }));
    } finally {
      connection.release();
    }
  }

  /**
   * Obtener estadísticas de acceso a un reporte
   */
  async getReportAccessStats(reportId: number): Promise<any> {
    const connection = await this.db.getConnection();
    try {
      const [stats] = await connection.query(
        `SELECT 
          action,
          COUNT(*) as count,
          MAX(created_at) as last_accessed
        FROM report_access_audit
        WHERE report_id = ?
        GROUP BY action`,
        [reportId],
      );

      const result: any = {
        viewed: 0,
        downloaded: 0,
        generated: 0,
        signed: 0,
        lastAccess: null,
      };

      (stats as any[]).forEach((row) => {
        if (row.action === "VIEWED") result.viewed = row.count;
        if (row.action === "DOWNLOADED") result.downloaded = row.count;
        if (row.action === "GENERATED") result.generated = row.count;
        if (row.action === "SIGNED") result.signed = row.count;
        if (
          !result.lastAccess ||
          new Date(row.last_accessed) > new Date(result.lastAccess)
        ) {
          result.lastAccess = row.last_accessed;
        }
      });

      return result;
    } finally {
      connection.release();
    }
  }
}
