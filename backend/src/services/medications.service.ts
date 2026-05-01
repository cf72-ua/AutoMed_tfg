/**
 * Servicio de Alarmas de Medicación
 */

import { getDatabase } from '../db/connection';

export interface CreateMedicationAlarmDto {
  patientId: number;
  medicationName: string;
  dose: string;
  frequency: string; // "daily", "twice_daily", "weekly", etc
  time: string; // HH:mm
  notes?: string;
}

export interface MedicationAlarmResponse {
  id: number;
  patientId: number;
  medicationName: string;
  dose: string;
  frequency: string;
  time: string;
  notes?: string;
  createdAt: Date;
}

export class MedicationsService {
  /**
   * Obtener todas las alarmas de medicación de un paciente
   */
  async getMedicationAlarmsByPatient(patientId: number): Promise<MedicationAlarmResponse[]> {
    const db = getDatabase();
    
    try {
      const [alarms]: any = await db.query(
        `SELECT id, patient_id as patientId, medication_name as medicationName, dose, frequency, time, notes, created_at as createdAt 
         FROM medication_alarms 
         WHERE patient_id = ? 
         ORDER BY time ASC`,
        [patientId]
      );

      return alarms;
    } catch (error) {
      console.error('Error getting medication alarms:', error);
      throw error;
    }
  }

  /**
   * Crear una nueva alarma de medicación
   */
  async createMedicationAlarm(dto: CreateMedicationAlarmDto): Promise<MedicationAlarmResponse> {
    const db = getDatabase();
    
    try {
      const [result]: any = await db.query(
        `INSERT INTO medication_alarms (patient_id, medication_name, dose, frequency, time, notes) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          dto.patientId,
          dto.medicationName,
          dto.dose,
          dto.frequency,
          dto.time,
          dto.notes || null
        ]
      );

      const alarmId = result.insertId;
      
      // Obtener y retornar la alarma creada
      const [alarms]: any = await db.query(
        `SELECT id, patient_id as patientId, medication_name as medicationName, dose, frequency, time, notes, created_at as createdAt 
         FROM medication_alarms 
         WHERE id = ?`,
        [alarmId]
      );

      return alarms[0];
    } catch (error) {
      console.error('Error creating medication alarm:', error);
      throw error;
    }
  }

  /**
   * Actualizar una alarma de medicación
   */
  async updateMedicationAlarm(alarmId: number, dto: Partial<CreateMedicationAlarmDto>): Promise<MedicationAlarmResponse> {
    const db = getDatabase();
    
    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (dto.medicationName) {
        updates.push('medication_name = ?');
        values.push(dto.medicationName);
      }
      if (dto.dose) {
        updates.push('dose = ?');
        values.push(dto.dose);
      }
      if (dto.frequency) {
        updates.push('frequency = ?');
        values.push(dto.frequency);
      }
      if (dto.time) {
        updates.push('time = ?');
        values.push(dto.time);
      }
      if (dto.notes !== undefined) {
        updates.push('notes = ?');
        values.push(dto.notes);
      }

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(alarmId);

      await db.query(
        `UPDATE medication_alarms SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      // Obtener y retornar la alarma actualizada
      const [alarms]: any = await db.query(
        `SELECT id, patient_id as patientId, medication_name as medicationName, dose, frequency, time, notes, created_at as createdAt 
         FROM medication_alarms 
         WHERE id = ?`,
        [alarmId]
      );

      return alarms[0];
    } catch (error) {
      console.error('Error updating medication alarm:', error);
      throw error;
    }
  }

  /**
   * Eliminar una alarma de medicación
   */
  async deleteMedicationAlarm(alarmId: number): Promise<void> {
    const db = getDatabase();
    
    try {
      await db.query(
        'DELETE FROM medication_alarms WHERE id = ?',
        [alarmId]
      );
    } catch (error) {
      console.error('Error deleting medication alarm:', error);
      throw error;
    }
  }
}
