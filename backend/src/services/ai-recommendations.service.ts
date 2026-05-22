import { getDatabase } from "../db/connection";

export interface HabitData {
  sleep: number;
  exercise: number;
  nutrition: number;
  stress: number;
  daysWithData: number;
}

export interface RecommendationResult {
  riskLevel: "BAJO" | "MEDIO" | "ALTO";
  riskScore: number;
  recommendations: string[];
  summary: string;
  timestamp: string;
}

type HabitRow = {
  habitType: "SLEEP" | "EXERCISE" | "NUTRITION" | "STRESS";
  value: number;
  loggedDate: string;
};

export class AIRecommendationsService {
  private static ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  private static model = process.env.OLLAMA_MODEL || "gemma2:2b";

  static async generateFromPatientHabits(
    patientId: number,
  ): Promise<RecommendationResult> {
    const db = getDatabase();
    // 1) Traer hábitos últimos 7 días
    const [rows] = await db.query(
      `
      SELECT habit_type as habitType,
             CAST(value AS DECIMAL(10,2)) as value,
             DATE_FORMAT(logged_date, '%Y-%m-%d') as loggedDate
      FROM habit_logs
      WHERE patient_id = ?
        AND logged_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
      ORDER BY logged_date ASC
      `,
      [patientId],
    );

    const habits = rows as HabitRow[];

    // 2) HabitData
    const habitData = this.summarize(habits);

    // 3) Score determinista
    const riskScore = this.computeRiskScore(habitData);
    const riskLevel: RecommendationResult["riskLevel"] =
      riskScore < 40 ? "BAJO" : riskScore < 70 ? "MEDIO" : "ALTO";

    // 4) IA (Gemma/Ollama)
    const ai = await this.askGemma(habitData, riskScore, riskLevel);

    return {
      riskLevel,
      riskScore,
      recommendations: ai.recommendations,
      summary: ai.summary,
      timestamp: new Date().toISOString(),
    };
  }

  private static summarize(habits: HabitRow[]): HabitData {
    const byDay = new Map<string, HabitRow[]>();
    for (const h of habits) {
      if (!byDay.has(h.loggedDate)) byDay.set(h.loggedDate, []);
      byDay.get(h.loggedDate)!.push(h);
    }

    const daysWithData = byDay.size;

    const valueForDay = (day: string, type: HabitRow["habitType"]) => {
      const arr = byDay.get(day) || [];
      const found = arr.filter((x) => x.habitType === type);
      if (found.length === 0) return 0;
      return Number(found[found.length - 1].value) || 0; // último del día
    };

    const days = Array.from(byDay.keys());

    const sleepVals = days
      .map((d) => valueForDay(d, "SLEEP"))
      .filter((v) => v > 0);
    const exerciseVals = days
      .map((d) => valueForDay(d, "EXERCISE"))
      .filter((v) => v > 0);
    const nutritionVals = days
      .map((d) => valueForDay(d, "NUTRITION"))
      .filter((v) => v > 0);
    const stressVals = days
      .map((d) => valueForDay(d, "STRESS"))
      .filter((v) => v > 0);

    const avg = (xs: number[]) =>
      xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

    const clamp13or0 = (n: number) => {
      if (!n || n <= 0) return 0;
      return Math.min(3, Math.max(1, n));
    };

    return {
      sleep: Number(avg(sleepVals).toFixed(1)),
      exercise: Math.round(sum(exerciseVals)),
      nutrition: clamp13or0(Math.round(avg(nutritionVals))),
      stress: clamp13or0(Math.round(avg(stressVals))),
      daysWithData,
    };
  }

  private static computeRiskScore(h: HabitData): number {
    let score = 50;

    // Sueño
    if (h.sleep > 0 && h.sleep < 6) score += 25;
    else if (h.sleep >= 6 && h.sleep < 7) score += 10;
    else if (h.sleep >= 7 && h.sleep <= 9) score -= 10;
    else if (h.sleep > 9) score += 5;

    // Ejercicio
    if (h.exercise >= 150) score -= 10;
    else if (h.exercise >= 90) score += 5;
    else score += 20;

    // Nutrición (0 = no registrado => no penaliza)
    if (h.nutrition === 1) score += 15;
    else if (h.nutrition === 2) score += 5;
    else if (h.nutrition === 3) score -= 5;

    // Estrés (0 = no registrado => no penaliza)
    if (h.stress === 3) score += 20;
    else if (h.stress === 2) score += 10;
    else if (h.stress === 1) score -= 5;

    if (h.daysWithData < 5) score += 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private static nutritionLabel(n: number) {
    return n === 0 ? "No registrado" : ["Mala", "Normal", "Balanceada"][n - 1];
  }
  private static stressLabel(n: number) {
    return n === 0 ? "No registrado" : ["Bajo", "Moderado", "Alto"][n - 1];
  }

  private static async askGemma(
    h: HabitData,
    riskScore: number,
    riskLevel: RecommendationResult["riskLevel"],
  ): Promise<{ recommendations: string[]; summary: string }> {
    if (h.daysWithData < 3) {
      return {
        recommendations: [
          "📌 Registra tus hábitos al menos 5 días por semana para obtener recomendaciones más precisas.",
          "🌙 Mantén horarios regulares de sueño y reduce pantallas antes de dormir.",
          "🏃 Suma actividad ligera diaria (por ejemplo, caminatas cortas).",
        ],
        summary:
          "Faltan datos suficientes para personalizar al máximo. Registra más días para mejorar la precisión.",
      };
    }

    const prompt = `
Devuelve SOLO JSON válido con este formato:
{
  "recommendations": ["...", "...", "..."],
  "summary": "..."
}

Datos (últimos 7 días):
- Sueño promedio (h/día): ${h.sleep}
- Ejercicio total (min/semana): ${h.exercise}
- Alimentación: ${this.nutritionLabel(h.nutrition)} (1-3)
- Estrés: ${this.stressLabel(h.stress)} (1-3)
- Días con datos: ${h.daysWithData}
- Riesgo calculado por el sistema: ${riskLevel} (${riskScore}/100)

Reglas:
- Máximo 3 recomendaciones, 1 frase cada una.
- Consejos generales, sin diagnóstico ni medicación.
- Si riesgo ALTO, sugiere consultar con un profesional.
`.trim();

    // timeout para evitar colgados
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    try {
      const res = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: { temperature: 0.4, num_predict: 240 },
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Ollama error ${res.status}: ${t}`);
      }

      const data = (await res.json()) as { response: string };
      const text = data.response ?? "";

      // parse seguro: extraer el bloque JSON
      const first = text.indexOf("{");
      const last = text.lastIndexOf("}");
      const jsonStr =
        first >= 0 && last > first ? text.slice(first, last + 1) : text;

      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        return {
          recommendations: [
            "🌙 Intenta mejorar la calidad del sueño con horarios regulares.",
            "🏃 Incrementa el ejercicio semanal de forma progresiva.",
            "🧘 Incluye una técnica breve de relajación diaria.",
          ],
          summary: `Tu perfil muestra un riesgo ${riskLevel.toLowerCase()}. Pequeños cambios sostenidos marcan la diferencia.`,
        };
      }

      const recs = Array.isArray(parsed.recommendations)
        ? parsed.recommendations.map(String)
        : [];
      const recommendations = recs
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3);
      while (recommendations.length < 3)
        recommendations.push(
          "✨ Mantén consistencia en tus hábitos esta semana.",
        );

      const summary =
        typeof parsed.summary === "string" && parsed.summary.trim().length > 0
          ? parsed.summary.trim()
          : `Riesgo ${riskLevel.toLowerCase()}.`;

      return { recommendations, summary };
    } finally {
      clearTimeout(timeout);
    }
  }
}
