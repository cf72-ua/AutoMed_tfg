/**
 * DTOs y tipos para el módulo de Reportes/Informes Médicos
 */

export interface CreateReportDTO {
  reportTypeId: number;
  title: string;
  body: string;
  metadata?: Record<string, any>;
  consultationId?: number;
}

export interface UpdateReportDTO {
  title?: string;
  body?: string;
  metadata?: Record<string, any>;
}

export interface SignReportDTO {
  signatureId: number;
}

export interface ReportResponse {
  id: number;
  reportTypeId: number;
  reportTypeName: string;
  patientId: number;
  professionalId: number;
  consultationId: number | null;
  title: string;
  body: string;
  metadata: Record<string, any> | null;
  status: "draft" | "signed" | "archived";
  signatureId: number | null;
  signedAt: Date | null;
  pdfUrl: string | null;
  pdfHash: string | null;
  pdfGeneratedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfessionalSignatureDTO {
  imageUrl: string;
  namePrinted: string;
}

export interface ProfessionalSignatureResponse {
  id: number;
  professionalId: number;
  imageUrl: string;
  imageName: string;
  namePrinted: string;
  isActive: boolean;
  createdAt: Date;
}

export interface ReportAccessAuditDTO {
  reportId: number;
  action: "VIEWED" | "DOWNLOADED" | "GENERATED" | "SIGNED" | "ARCHIVED";
  ipAddress?: string;
  userAgent?: string;
  reasonNotes?: string;
}

export interface ReportAccessAuditResponse {
  id: number;
  reportId: number;
  actorUserId: number;
  actorName: string;
  action: string;
  ipAddress: string | null;
  reasonNotes: string | null;
  createdAt: Date;
}

export interface ReportListResponse {
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

export interface ReportTypeResponse {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  templateName: string;
  requiredFields: string[];
}
