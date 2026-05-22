/**
 * Servicio Angular para Reportes/Informes Médicos
 */

import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable, BehaviorSubject } from "rxjs";
import { tap } from "rxjs/operators";
import { environment } from "../../../environments/environment";

export interface Report {
  id: number;
  reportTypeId: number;
  reportTypeName: string;
  patientId: number;
  professionalId: number;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  status: "draft" | "signed" | "archived";
  signatureId: number | null;
  signedAt: Date | null;
  pdfUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportListItem {
  id: number;
  reportTypeId: number;
  title: string;
  reportTypeName: string;
  status: string;
  patientName: string;
  professionalName: string;
  createdAt: Date;
  signedAt: Date | null;
  pdfUrl: string | null;
}

export interface ReportType {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  templateName: string;
  requiredFields: string[];
}

export interface ProfessionalSignature {
  id: number;
  professionalId: number;
  imageUrl: string;
  imageName: string;
  namePrinted: string;
  isActive: boolean;
  createdAt: Date;
}

export interface ReportAccessAudit {
  id: number;
  reportId: number;
  actorUserId: number;
  actorName: string;
  action: string;
  ipAddress: string | null;
  reasonNotes: string | null;
  createdAt: Date;
}

export interface CreateReportDTO {
  reportTypeId: number;
  title: string;
  body: string;
  consultationId?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateReportDTO {
  title?: string;
  body?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLog {
  id: number;
  action: string;
  actor_type: string;
  actor_id: number;
  timestamp: string;
}

export interface PatientInfo {
  id: number;
  fullName: string;
  email: string;
  dni: string;
  dateOfBirth?: string;
  phone?: string;
}

@Injectable({
  providedIn: "root",
})
export class ReportsService {
  private apiUrl = `${environment.apiUrl}/reports`;
  private reportsSubject = new BehaviorSubject<ReportListItem[]>([]);
  public reports$ = this.reportsSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Obtener lista de pacientes que el doctor puede atender
   */
  getPatients(): Observable<PatientInfo[]> {
    return this.http.get<PatientInfo[]>(`${environment.apiUrl}/patients`);
  }

  /**
   * Obtener tipos de informe
   */
  getReportTypes(): Observable<ReportType[]> {
    return this.http.get<ReportType[]>(`${environment.apiUrl}/report-types`);
  }

  /**
   * Crear nuevo informe
   */
  createReport(patientId: number, data: CreateReportDTO): Observable<Report> {
    return this.http.post<Report>(`${this.apiUrl}`, {
      ...data,
      patientId,
    });
  }

  /**
   * Obtener informe por ID
   */
  getReportById(reportId: number): Observable<Report> {
    return this.http.get<Report>(`${this.apiUrl}/${reportId}`);
  }

  /**
   * Actualizar informe (borrador)
   */
  updateReport(reportId: number, data: UpdateReportDTO): Observable<Report> {
    return this.http.put<Report>(`${this.apiUrl}/${reportId}`, data);
  }

  /**
   * Firmar informe y generar PDF
   */
  signReport(reportId: number, signatureId: number): Observable<Report> {
    return this.http.post<Report>(`${this.apiUrl}/${reportId}/sign`, {
      signatureId,
    });
  }

  /**
   * Descargar PDF del informe
   */
  downloadReportPDF(reportId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${reportId}/download`, {
      responseType: "blob" as "json",
    }) as Observable<Blob>;
  }

  /**
   * Listar informes visibles para el usuario actual
   */
  listReports(filters?: {
    status?: string;
    reportTypeId?: number;
    fromDate?: Date;
    toDate?: Date;
  }): Observable<ReportListItem[]> {
    let params = new HttpParams();

    if (filters) {
      if (filters.status) params = params.set("status", filters.status);
      if (filters.reportTypeId)
        params = params.set("reportTypeId", filters.reportTypeId.toString());
      if (filters.fromDate)
        params = params.set("fromDate", filters.fromDate.toISOString());
      if (filters.toDate)
        params = params.set("toDate", filters.toDate.toISOString());
    }

    return this.http
      .get<ReportListItem[]>(this.apiUrl, { params })
      .pipe(tap((reports) => this.reportsSubject.next(reports)));
  }

  /**
   * Listar informes de un paciente
   */
  listPatientReports(
    patientId: number,
    filters?: {
      status?: string;
      reportTypeId?: number;
      fromDate?: Date;
      toDate?: Date;
    },
  ): Observable<ReportListItem[]> {
    let params = new HttpParams();

    if (filters) {
      if (filters.status) params = params.set("status", filters.status);
      if (filters.reportTypeId)
        params = params.set("reportTypeId", filters.reportTypeId.toString());
      if (filters.fromDate)
        params = params.set("fromDate", filters.fromDate.toISOString());
      if (filters.toDate)
        params = params.set("toDate", filters.toDate.toISOString());
    }

    return this.http
      .get<
        ReportListItem[]
      >(`${environment.apiUrl}/patients/${patientId}/reports`, { params })
      .pipe(tap((reports) => this.reportsSubject.next(reports)));
  }

  /**
   * Obtener auditoría de un informe
   */
  getReportAuditLog(
    reportId: number,
    limit = 100,
    offset = 0,
  ): Observable<ReportAccessAudit[]> {
    const params = new HttpParams()
      .set("limit", limit.toString())
      .set("offset", offset.toString());

    return this.http.get<ReportAccessAudit[]>(
      `${this.apiUrl}/${reportId}/audit`,
      { params },
    );
  }

  /**
   * Obtener auditoría global (ADMIN)
   */
  getGlobalAuditLog(
    filters?: {
      action?: string;
      actorUserId?: number;
      fromDate?: Date;
      toDate?: Date;
    },
    limit = 100,
    offset = 0,
  ): Observable<AuditLog[]> {
    let params = new HttpParams()
      .set("limit", limit.toString())
      .set("offset", offset.toString());

    if (filters) {
      if (filters.action) params = params.set("action", filters.action);
      if (filters.actorUserId)
        params = params.set("actorUserId", filters.actorUserId.toString());
      if (filters.fromDate)
        params = params.set("fromDate", filters.fromDate.toISOString());
      if (filters.toDate)
        params = params.set("toDate", filters.toDate.toISOString());
    }

    return this.http.get<AuditLog[]>(`${environment.apiUrl}/audit/global`, {
      params,
    });
  }

  /**
   * Obtener estadísticas de acceso
   */
  getReportAccessStats(reportId: number): Observable<Record<string, unknown>> {
    return this.http.get(`${this.apiUrl}/${reportId}/stats`) as Observable<
      Record<string, unknown>
    >;
  }

  /**
   * Actualizar caché de reportes
   */
  refreshReports(reports: ReportListItem[]): void {
    this.reportsSubject.next(reports);
  }
}
