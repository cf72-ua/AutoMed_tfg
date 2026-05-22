export interface ExtractReportMetadataInput {
  reportTypeName?: string;
  title: string;
  body: string;
  observations?: string;
}

export class ReportMetadataExtractionService {
  private ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  private model = process.env.OLLAMA_MODEL || "gemma2:2b";

  async extract(
    input: ExtractReportMetadataInput,
  ): Promise<Record<string, any>> {
    const observations = input.observations?.trim() || "";

    try {
      const parsed = await this.askModel(input);
      return {
        ...parsed,
        observations: observations || null,
        aiExtractedAt: new Date().toISOString(),
        aiModel: this.model,
      };
    } catch (error) {
      console.error("Error extracting report metadata:", error);
      return {
        observations: observations || null,
        aiExtractionStatus: "failed",
      };
    }
  }

  private async askModel(
    input: ExtractReportMetadataInput,
  ): Promise<Record<string, any>> {
    const prompt = `
Devuelve SOLO JSON válido con este formato:
{
  "clinicalSummary": "...",
  "reasonForConsultation": "...",
  "symptoms": ["...", "..."],
  "relevantHistory": ["...", "..."],
  "diagnosis": ["...", "..."],
  "treatmentPlan": ["...", "..."],
  "medications": [{"name": "...", "dose": "...", "frequency": "...", "duration": "..."}],
  "duration": "...",
  "tests": ["...", "..."],
  "followUp": ["...", "..."],
  "warnings": ["...", "..."],
  "missingData": ["...", "..."]
}

Tipo de informe: ${input.reportTypeName || "No especificado"}
Título: ${input.title}
Observaciones del profesional:
${input.observations || "Sin observaciones adicionales."}

Contenido clínico libre:
${input.body}

Reglas:
- Extrae solo datos explícitos del contenido y observaciones.
- No inventes síntomas, diagnósticos, pruebas, tratamientos ni medicación.
- Si no hay información para un campo, usa "" o [].
- Usa español clínico claro.
- No incluyas texto fuera del JSON.
`.trim();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const res = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: { temperature: 0.1, num_predict: 700 },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ollama error ${res.status}: ${text}`);
      }

      const data = (await res.json()) as { response: string };
      return this.parseJson(data.response || "");
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseJson(response: string): Record<string, any> {
    const first = response.indexOf("{");
    const last = response.lastIndexOf("}");
    const jsonText =
      first >= 0 && last > first ? response.slice(first, last + 1) : response;

    const parsed = JSON.parse(jsonText);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  }
}
