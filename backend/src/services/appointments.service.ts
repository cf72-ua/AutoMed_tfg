/**
 * Servicio de Citas/Consultas
 */

import { getDatabase } from '../db/connection';

export interface CreateAppointmentDto {
  patientId: number;
  doctorId?: number;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  place?: string;
  notes?: string;
}

export interface AppointmentResponse {
  id: number;
  patientId: number;
  doctorId?: number;
  title: string;
  date: string;
  time?: string;
  place?: string;
  notes?: string;
  createdAt: Date;
}

export class AppointmentsService {
  /**
   * Obtener todas las citas de un paciente
   */
  async getAppointmentsByPatient(patientId: number): Promise<AppointmentResponse[]> {
    const db = getDatabase();
    
    try {
      const [appointments]: any = await db.query(
        `SELECT id, patient_id as patientId, doctor_id as doctorId, title, date, time, place, notes, created_at as createdAt 
         FROM appointments 
         WHERE patient_id = ? 
         ORDER BY date DESC`,
        [patientId]
      );

      return appointments;
    } catch (error) {
      console.error('Error getting appointments:', error);
      throw error;
    }
  }

  /**
   * Crear una nueva cita
   */
  async createAppointment(dto: CreateAppointmentDto): Promise<AppointmentResponse> {
    const db = getDatabase();
    
    try {
      const [result]: any = await db.query(
        `INSERT INTO appointments (patient_id, doctor_id, title, date, time, place, notes, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dto.patientId,
          dto.doctorId || null,
          dto.title,
          dto.date,
          dto.time || null,
          dto.place || null,
          dto.notes || null,
          'scheduled'
        ]
      );

      const appointmentId = result.insertId;
      
      // Obtener y retornar la cita creada
      const [appointments]: any = await db.query(
        `SELECT id, patient_id as patientId, doctor_id as doctorId, title, date, time, place, notes, created_at as createdAt 
         FROM appointments 
         WHERE id = ?`,
        [appointmentId]
      );

      return appointments[0];
    } catch (error) {
      console.error('Error creating appointment:', error);
      throw error;
    }
  }

  /**
   * Actualizar una cita
   */
  async updateAppointment(appointmentId: number, dto: Partial<CreateAppointmentDto>): Promise<AppointmentResponse> {
    const db = getDatabase();
    
    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (dto.title) {
        updates.push('title = ?');
        values.push(dto.title);
      }
      if (dto.date) {
        updates.push('date = ?');
        values.push(dto.date);
      }
      if (dto.time) {
        updates.push('time = ?');
        values.push(dto.time);
      }
      if (dto.place) {
        updates.push('place = ?');
        values.push(dto.place);
      }
      if (dto.notes) {
        updates.push('notes = ?');
        values.push(dto.notes);
      }

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(appointmentId);

      await db.query(
        `UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      // Obtener y retornar la cita actualizada
      const [appointments]: any = await db.query(
        `SELECT id, patient_id as patientId, doctor_id as doctorId, title, date, time, place, notes, created_at as createdAt 
         FROM appointments 
         WHERE id = ?`,
        [appointmentId]
      );

      return appointments[0];
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  }

  /**
   * Eliminar una cita
   */
  async deleteAppointment(appointmentId: number): Promise<void> {
    const db = getDatabase();
    
    try {
      await db.query(
        'DELETE FROM appointments WHERE id = ?',
        [appointmentId]
      );
    } catch (error) {
      console.error('Error deleting appointment:', error);
      throw error;
    }
  }
}
