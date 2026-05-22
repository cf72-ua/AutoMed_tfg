export interface NutritionScoreResult {
  score: 1 | 2 | 3;
  rationale: string;
}

export class NutritionScoreService {
  private static ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  private static model = process.env.OLLAMA_MODEL || "gemma2:2b";

  static async scoreDailyIntake(
    foodLog: string,
  ): Promise<NutritionScoreResult> {
    const cleanFoodLog = foodLog.trim();
    if (!cleanFoodLog) {
      throw new Error("Describe lo que has comido durante el día");
    }

    const prompt = `
Devuelve SOLO JSON válido con este formato:
{
  "score": 1,
  "rationale": "..."
}

Texto escrito por el paciente sobre lo ingerido durante el día:
${cleanFoodLog}

Escala obligatoria:
- 1 = alimentación de baja calidad nutricional: predominio de ultraprocesados, azúcares, alcohol, fritos, exceso calórico evidente, escasa fruta/verdura/proteína/fibra o comidas muy incompletas.
- 2 = alimentación aceptable o mixta: incluye algunos alimentos saludables, pero presenta desequilibrios, carencias, exceso de refinados o información insuficiente para considerarla balanceada.
- 3 = alimentación balanceada: variedad adecuada, presencia de verduras/frutas, proteína de calidad, hidratos complejos o fibra, grasas saludables e hidratación razonable.

Reglas:
- El campo "score" debe ser SOLO 1, 2 o 3.
- Evalúa únicamente la calidad nutricional del día descrito.
- No diagnostiques enfermedades ni recomiendes medicación.
- Si la descripción es vaga o insuficiente, usa score 2 salvo que sea claramente mala.
- "rationale" debe ser una frase breve en español.
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
          options: { temperature: 0.1, num_predict: 180 },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ollama error ${res.status}: ${text}`);
      }

      const data = (await res.json()) as { response: string };
      return this.parseResponse(data.response || "");
    } finally {
      clearTimeout(timeout);
    }
  }

  private static parseResponse(response: string): NutritionScoreResult {
    const first = response.indexOf("{");
    const last = response.lastIndexOf("}");
    const jsonText =
      first >= 0 && last > first ? response.slice(first, last + 1) : response;
    const parsed = JSON.parse(jsonText);
    const score = Number(parsed.score);

    if (![1, 2, 3].includes(score)) {
      throw new Error("La IA no devolvió un nutriscore válido");
    }

    return {
      score: score as 1 | 2 | 3,
      rationale:
        typeof parsed.rationale === "string" && parsed.rationale.trim()
          ? parsed.rationale.trim()
          : "Evaluación nutricional generada por IA",
    };
  }
}
