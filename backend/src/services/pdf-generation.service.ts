/**
 * Servicio de Generación de PDF con Playwright
 * Utiliza Handlebars para renderizar templates HTML → PDF
 */

import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";
import Handlebars from "handlebars";
import { getDatabase } from "../db/connection";

export class PDFGenerationService {
  private templatesDir = this.resolveTemplatesDir();
  private pdfStorageDir = path.join(process.cwd(), "../storage/reports");
  private signaturesStorageDir = path.join(
    process.cwd(),
    "../storage/signatures",
  );
  private get db() {
    return getDatabase();
  }

  constructor() {
    // Crear directorios si no existen
    if (!fs.existsSync(this.pdfStorageDir)) {
      fs.mkdirSync(this.pdfStorageDir, { recursive: true });
    }
  }

  private resolveTemplatesDir(): string {
    const localTemplatesDir = path.join(process.cwd(), "templates");
    if (fs.existsSync(localTemplatesDir)) {
      return localTemplatesDir;
    }

    return path.join(process.cwd(), "backend/templates");
  }

  /**
   * Generar PDF desde un reporte
   */
  async generateReportPDF(
    reportId: number,
  ): Promise<{ pdfPath: string; fileName: string }> {
    try {
      // Obtener datos del reporte
      const reportData = await this.getReportDataForPDF(reportId);

      // Obtener template
      const template = await this.loadTemplate(
        reportData.reportType.templateName,
      );

      // Compilar y renderizar template con Handlebars
      const compiledTemplate = Handlebars.compile(template);
      const htmlContent = compiledTemplate(reportData);

      // Generar PDF con Playwright
      const pdfFileName = `report-${reportId}-${Date.now()}.pdf`;
      const pdfPath = path.join(this.pdfStorageDir, pdfFileName);

      const browser = await chromium.launch();
      const page = await browser.newPage();

      await page.setContent(htmlContent, { waitUntil: "networkidle" });

      // Configurar formato PDF
      await page.pdf({
        path: pdfPath,
        format: "A4",
        margin: {
          top: "1cm",
          right: "1cm",
          bottom: "1cm",
          left: "1cm",
        },
        printBackground: true,
      });

      await browser.close();

      return {
        pdfPath: `/reports/${pdfFileName}`,
        fileName: pdfFileName,
      };
    } catch (error) {
      console.error("Error generando PDF:", error);
      throw new Error(`No se pudo generar el PDF: ${(error as any).message}`);
    }
  }

  /**
   * Obtener datos del reporte para PDF
   */
  private async getReportDataForPDF(reportId: number): Promise<any> {
    const connection = await this.db.getConnection();
    try {
      const [reportRows] = await connection.query(
        `SELECT mr.*, rt.name as report_type_name, rt.slug, rt.template_name,
                p.full_name as patient_name,
                prof.full_name as professional_name,
                prof_cat.name as professional_category,
                ps.image_url as signature_image,
                ps.name_printed
        FROM medical_reports mr
        JOIN report_types rt ON mr.report_type_id = rt.id
        JOIN patient_profiles pat ON mr.patient_id = pat.id
        JOIN users p ON pat.user_id = p.id
        JOIN professional_profiles prof_prof ON mr.professional_id = prof_prof.id
        JOIN users prof ON prof_prof.user_id = prof.id
        LEFT JOIN professional_categories prof_cat ON prof_prof.category_id = prof_cat.id
        LEFT JOIN professional_signatures ps ON mr.signature_id = ps.id
        WHERE mr.id = ?`,
        [reportId],
      );

      if ((reportRows as any[]).length === 0) {
        throw new Error(`Reporte no encontrado: ${reportId}`);
      }

      const report = (reportRows as any[])[0];
      if (!report.template_name) {
        throw new Error(
          `El tipo de reporte ${report.report_type_id} no tiene template configurado`,
        );
      }

      const signatureDataUri = report.signature_image
        ? this.getSignatureDataUri(report.signature_image)
        : null;

      return {
        id: report.id,
        title: report.title,
        status: report.status,
        createdAt: new Date(report.created_at).toLocaleDateString("es-ES"),
        signedAt: report.signed_at
          ? new Date(report.signed_at).toLocaleDateString("es-ES")
          : null,
        body: report.body,
        metadata: this.parseJsonColumn(report.metadata),
        patient: {
          name: report.patient_name,
        },
        professional: {
          name: report.professional_name,
          category: report.professional_category,
          signature: signatureDataUri,
          signatureName: report.name_printed,
        },
        reportType: {
          name: report.report_type_name,
          slug: report.slug,
          templateName: report.template_name,
        },
        generatedAt: new Date().toLocaleDateString("es-ES"),
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Cargar template Handlebars
   */
  private async loadTemplate(templateName: string): Promise<string> {
    if (!templateName) {
      throw new Error("Template no configurado para este tipo de reporte");
    }

    const templatePath = path.join(this.templatesDir, templateName);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template no encontrado: ${templateName}`);
    }

    return fs.readFileSync(templatePath, "utf-8");
  }

  private parseJsonColumn(value: unknown): Record<string, any> {
    if (!value) return {};
    if (typeof value === "object") return value as Record<string, any>;
    if (typeof value !== "string") return {};

    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  /**
   * Registrar handlebar helpers (funciones disponibles en templates)
   */
  private registerHelpers(): void {
    Handlebars.registerHelper("formatDate", (date: Date) => {
      return new Date(date).toLocaleDateString("es-ES");
    });

    Handlebars.registerHelper("eq", (a: any, b: any) => a === b);

    Handlebars.registerHelper(
      "ifCond",
      (v1: any, operator: string, v2: any, options: any) => {
        switch (operator) {
          case "==":
            return v1 == v2 ? options.fn(this) : options.inverse(this);
          case "!=":
            return v1 != v2 ? options.fn(this) : options.inverse(this);
          case "<":
            return v1 < v2 ? options.fn(this) : options.inverse(this);
          case ">":
            return v1 > v2 ? options.fn(this) : options.inverse(this);
          default:
            return options.inverse(this);
        }
      },
    );
  }

  /**
   * Obtener nombre de archivo
   */
  private getFileName(filePath: string): string {
    return filePath.split("/").pop() || "";
  }

  /**
   * Convertir la firma en data URI para que Playwright pueda incrustarla en el PDF
   */
  private getSignatureDataUri(signaturePath: string): string | null {
    const fileName = this.getFileName(signaturePath);
    const absolutePath = path.join(this.signaturesStorageDir, fileName);

    if (!fileName || !fs.existsSync(absolutePath)) {
      console.warn(`Firma no encontrada para PDF: ${absolutePath}`);
      return null;
    }

    const imageBuffer = fs.readFileSync(absolutePath);
    return `data:image/png;base64,${imageBuffer.toString("base64")}`;
  }
}
