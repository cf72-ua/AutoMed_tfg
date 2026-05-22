/**
 * Servicio de Hábitos
 */

import { getDatabase } from "../db/connection";
import { NutritionScoreService } from "./nutrition-score.service";

export interface CreateHabitLogDto {
  patientId: number;
  habitType: "SLEEP" | "EXERCISE" | "NUTRITION" | "STRESS";
  value?: number;
  notes?: string;
  loggedDate: string;
}

export interface HabitLogResponse {
  id: number;
  patientId: number;
  habitType: string;
  value: number;
  notes?: string;
  loggedDate: string;
  createdAt: Date;
}

export class HabitsService {
  /**
   * Obtener todos los hábitos de un paciente
   */
  async getHabitsByPatient(patientId: number): Promise<HabitLogResponse[]> {
    const db = getDatabase();

    try {
      const [habits]: any = await db.query(
        `SELECT id, patient_id as patientId, habit_type as habitType, value, notes, logged_date as loggedDate, created_at as createdAt 
         FROM habit_logs 
         WHERE patient_id = ? 
         ORDER BY logged_date DESC`,
        [patientId],
      );

      return habits;
    } catch (error) {
      console.error("Error getting habits:", error);
      throw error;
    }
  }

  /**
   * Obtener hábitos de un tipo específico para un rango de fechas
   */
  async getHabitsByType(
    patientId: number,
    habitType: string,
    startDate: string,
    endDate: string,
  ): Promise<HabitLogResponse[]> {
    const db = getDatabase();

    try {
      const [habits]: any = await db.query(
        `SELECT id, patient_id as patientId, habit_type as habitType, value, notes, DATE_FORMAT(logged_date, '%Y-%m-%d') as loggedDate, created_at as createdAt 
         FROM habit_logs 
         WHERE patient_id = ? AND habit_type = ? AND logged_date >= ? AND logged_date <= ? 
         ORDER BY logged_date ASC`,
        [patientId, habitType, startDate, endDate],
      );

      return habits;
    } catch (error) {
      console.error("Error getting habits by type:", error);
      throw error;
    }
  }

  /**
   * Crear un nuevo registro de hábito
   */
  async createHabitLog(dto: CreateHabitLogDto): Promise<HabitLogResponse> {
    const db = getDatabase();

    try {
      let value = dto.value;
      let notes = dto.notes || null;

      if (dto.habitType === "NUTRITION") {
        const foodLog = dto.notes?.trim();
        if (!foodLog) {
          throw new Error("Describe lo que has comido durante el día");
        }

        const nutritionScore =
          await NutritionScoreService.scoreDailyIntake(foodLog);
        value = nutritionScore.score;
        notes = `${foodLog}\n\nNutriscore IA: ${nutritionScore.score}/3. ${nutritionScore.rationale}`;
      }

      if (value === undefined || Number.isNaN(Number(value))) {
        throw new Error("Valor de hábito inválido");
      }

      const [result]: any = await db.query(
        `INSERT INTO habit_logs (patient_id, habit_type, value, notes, logged_date) 
         VALUES (?, ?, ?, ?, ?)`,
        [dto.patientId, dto.habitType, value, notes, dto.loggedDate],
      );

      const habitId = result.insertId;

      // Obtener y retornar el hábito creado
      const [habits]: any = await db.query(
        `SELECT id, patient_id as patientId, habit_type as habitType, value, notes, logged_date as loggedDate, created_at as createdAt 
         FROM habit_logs 
         WHERE id = ?`,
        [habitId],
      );

      return habits[0];
    } catch (error) {
      console.error("Error creating habit log:", error);
      throw error;
    }
  }

  /**
   * Actualizar un registro de hábito
   */
  async updateHabitLog(
    habitId: number,
    dto: Partial<CreateHabitLogDto>,
  ): Promise<HabitLogResponse> {
    const db = getDatabase();

    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (dto.value !== undefined) {
        updates.push("value = ?");
        values.push(dto.value);
      }
      if (dto.notes !== undefined) {
        updates.push("notes = ?");
        values.push(dto.notes);
      }
      if (dto.loggedDate) {
        updates.push("logged_date = ?");
        values.push(dto.loggedDate);
      }

      if (updates.length === 0) {
        throw new Error("No fields to update");
      }

      values.push(habitId);

      await db.query(
        `UPDATE habit_logs SET ${updates.join(", ")} WHERE id = ?`,
        values,
      );

      const [habits]: any = await db.query(
        `SELECT id, patient_id as patientId, habit_type as habitType, value, notes, logged_date as loggedDate, created_at as createdAt 
         FROM habit_logs 
         WHERE id = ?`,
        [habitId],
      );

      return habits[0];
    } catch (error) {
      console.error("Error updating habit log:", error);
      throw error;
    }
  }

  /**
   * Eliminar un registro de hábito
   */
  async deleteHabitLog(habitId: number): Promise<void> {
    const db = getDatabase();

    try {
      await db.query("DELETE FROM habit_logs WHERE id = ?", [habitId]);
    } catch (error) {
      console.error("Error deleting habit log:", error);
      throw error;
    }
  }
}
