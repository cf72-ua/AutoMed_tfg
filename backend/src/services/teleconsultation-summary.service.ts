import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";
import Handlebars from "handlebars";
import { getDatabase } from "../db/connection";

interface TranscriptMessage {
  senderName: string;
  senderRole: "PACIENTE" | "DOCTOR";
  content: string;
  createdAt: Date;
}

interface SummarySource {
  id: number;
  purpose: string;
  status: string;
  patientName: string;
  doctorName: string;
  startedAt: Date | null;
  endedAt: Date | null;
  messages: TranscriptMessage[];
}

interface ClinicalSummary {
  title: string;
  summary: string;
  clinicalFindings: string[];
  relevantHistory: string[];
  assessment: string[];
  recommendations: string[];
}

export class TeleconsultationSummaryService {
  private ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  private model = process.env.OLLAMA_MODEL || "gemma2:2b";
  private pdfStorageDir = path.join(process.cwd(), "../storage/reports");

  constructor() {
    if (!fs.existsSync(this.pdfStorageDir)) {
      fs.mkdirSync(this.pdfStorageDir, { recursive: true });
    }
  }

  async generatePdf(
    consultationId: number,
    requesterUserId: number,
  ): Promise<{ absolutePath: string; fileName: string }> {
    const source = await this.getSummarySource(consultationId, requesterUserId);

    if (source.status !== "closed") {
      throw new Error(
        "Solo se puede generar resumen de una teleconsulta finalizada",
      );
    }

    const summary = await this.generateClinicalSummary(source);
    const html = this.renderHtml(source, summary);
    const fileName = `teleconsulta-${consultationId}-resumen-${Date.now()}.pdf`;
    const absolutePath = path.join(this.pdfStorageDir, fileName);

    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle" });
      await page.pdf({
        path: absolutePath,
        format: "A4",
        margin: {
          top: "1.2cm",
          right: "1.2cm",
          bottom: "1.2cm",
          left: "1.2cm",
        },
        printBackground: true,
      });
    } finally {
      await browser.close();
    }

    return { absolutePath, fileName };
  }

  private async getSummarySource(
    consultationId: number,
    requesterUserId: number,
  ): Promise<SummarySource> {
    const db = getDatabase();
    const [consultationRows]: any = await db.query(
      `
      SELECT
        c.id,
        c.purpose,
        c.status,
        c.started_at as startedAt,
        c.ended_at as endedAt,
        patient_user.full_name as patientName,
        doctor_user.full_name as doctorName
      FROM consultations c
      INNER JOIN patient_profiles patient_profile ON c.patient_id = patient_profile.id
      INNER JOIN users patient_user ON patient_profile.user_id = patient_user.id
      INNER JOIN professional_profiles doctor_profile ON c.professional_id = doctor_profile.id
      INNER JOIN users doctor_user ON doctor_profile.user_id = doctor_user.id
      WHERE c.id = ?
        AND (patient_profile.user_id = ? OR doctor_profile.user_id = ?)
      LIMIT 1
      `,
      [consultationId, requesterUserId, requesterUserId],
    );

    if (consultationRows.length === 0) {
      throw new Error("No tienes acceso a esta teleconsulta");
    }

    const [messageRows]: any = await db.query(
      `
      SELECT
        u.full_name as senderName,
        CASE
          WHEN patient_profile.user_id = m.sender_user_id THEN 'PACIENTE'
          ELSE 'DOCTOR'
        END as senderRole,
        m.content,
        m.created_at as createdAt
      FROM messages m
      INNER JOIN users u ON m.sender_user_id = u.id
      INNER JOIN consultations c ON m.consultation_id = c.id
      INNER JOIN patient_profiles patient_profile ON c.patient_id = patient_profile.id
      WHERE m.consultation_id = ?
      ORDER BY m.created_at ASC, m.id ASC
      `,
      [consultationId],
    );

    return {
      ...consultationRows[0],
      messages: messageRows,
    };
  }

  private async generateClinicalSummary(
    source: SummarySource,
  ): Promise<ClinicalSummary> {
    const transcript = source.messages
      .map((message) => {
        const date = new Date(message.createdAt).toISOString();
        return `[${date}] ${message.senderRole} (${message.senderName}): ${message.content}`;
      })
      .join("\n");

    const prompt = `
Devuelve SOLO JSON válido con este formato:
{
  "title": "Resumen clínico de teleconsulta",
  "summary": "...",
  "clinicalFindings": ["...", "..."],
  "relevantHistory": ["...", "..."],
  "assessment": ["...", "..."],
  "recommendations": ["...", "..."]
}

Contexto:
- Motivo declarado: ${source.purpose}
- Paciente: ${source.patientName}
- Profesional: ${source.doctorName}

Transcripción de chat:
${transcript || "Sin mensajes registrados."}

Reglas estrictas:
- Extrae únicamente contenido relacionado con salud, síntomas, antecedentes, medicación, signos clínicos, evolución, pruebas, hábitos con impacto sanitario, orientación diagnóstica o recomendaciones clínicas.
- Omite saludos, logística, conversación social, agradecimientos, dudas técnicas de la plataforma y cualquier contenido no sanitario.
- Usa lenguaje técnico médico en español.
- No inventes datos, diagnósticos, exploración física, constantes, pruebas ni tratamientos.
- Si un apartado no tiene datos clínicos suficientes, escribe "No consta en la transcripción".
- No incluyas mensajes literales ni datos administrativos innecesarios.
- No indiques que eres IA.
`.trim();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const res = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: { temperature: 0.2, num_predict: 900 },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ollama error ${res.status}: ${text}`);
      }

      const data = (await res.json()) as { response: string };
      return this.parseClinicalSummary(data.response || "");
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseClinicalSummary(response: string): ClinicalSummary {
    const first = response.indexOf("{");
    const last = response.lastIndexOf("}");
    const jsonText =
      first >= 0 && last > first ? response.slice(first, last + 1) : response;

    const parsed = JSON.parse(jsonText);
    const asList = (value: unknown): string[] => {
      if (!Array.isArray(value)) return ["No consta en la transcripción"];
      const items = value
        .map(String)
        .map((item) => item.trim())
        .filter(Boolean);
      return items.length ? items : ["No consta en la transcripción"];
    };

    return {
      title:
        typeof parsed.title === "string" && parsed.title.trim()
          ? parsed.title.trim()
          : "Resumen clínico de teleconsulta",
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim()
          ? parsed.summary.trim()
          : "No consta en la transcripción",
      clinicalFindings: asList(parsed.clinicalFindings),
      relevantHistory: asList(parsed.relevantHistory),
      assessment: asList(parsed.assessment),
      recommendations: asList(parsed.recommendations),
    };
  }

  private renderHtml(source: SummarySource, summary: ClinicalSummary): string {
    const template = Handlebars.compile(`
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>{{summary.title}}</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        color: #17212b;
        font-size: 12px;
        line-height: 1.45;
      }
      h1 {
        margin: 0 0 8px;
        color: #0f4b7a;
        font-size: 22px;
      }
      h2 {
        margin: 18px 0 8px;
        color: #17324d;
        font-size: 14px;
        border-bottom: 1px solid #dbe4ee;
        padding-bottom: 4px;
      }
      .meta {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 18px;
        margin: 12px 0 16px;
        padding: 10px;
        background: #f5f8fb;
        border: 1px solid #dbe4ee;
      }
      .label {
        font-weight: 700;
        color: #526273;
      }
      ul {
        margin: 0;
        padding-left: 18px;
      }
      li {
        margin: 4px 0;
      }
      .notice {
        margin-top: 20px;
        padding-top: 10px;
        border-top: 1px solid #dbe4ee;
        color: #667789;
        font-size: 10px;
      }
    </style>
  </head>
  <body>
    <h1>{{summary.title}}</h1>
    <div class="meta">
      <div><span class="label">Paciente:</span> {{source.patientName}}</div>
      <div><span class="label">Profesional:</span> {{source.doctorName}}</div>
      <div><span class="label">Teleconsulta:</span> #{{source.id}}</div>
      <div><span class="label">Fecha de cierre:</span> {{endedAt}}</div>
      <div><span class="label">Motivo:</span> {{source.purpose}}</div>
      <div><span class="label">Generado:</span> {{generatedAt}}</div>
    </div>

    <h2>Síntesis clínica</h2>
    <p>{{summary.summary}}</p>

    <h2>Hallazgos clínicos referidos</h2>
    <ul>{{#each summary.clinicalFindings}}<li>{{this}}</li>{{/each}}</ul>

    <h2>Antecedentes y datos relevantes</h2>
    <ul>{{#each summary.relevantHistory}}<li>{{this}}</li>{{/each}}</ul>

    <h2>Valoración médica orientativa</h2>
    <ul>{{#each summary.assessment}}<li>{{this}}</li>{{/each}}</ul>

    <h2>Recomendaciones clínicas documentadas</h2>
    <ul>{{#each summary.recommendations}}<li>{{this}}</li>{{/each}}</ul>

    <p class="notice">
      Documento generado a partir del contenido sanitario de la teleconsulta finalizada.
      La información no sanitaria de la conversación ha sido omitida.
    </p>
  </body>
</html>
`);

    return template({
      source,
      summary,
      endedAt: source.endedAt
        ? new Date(source.endedAt).toLocaleString("es-ES")
        : "No consta",
      generatedAt: new Date().toLocaleString("es-ES"),
    });
  }
}
