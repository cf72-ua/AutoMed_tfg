import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Appointment {
  id: number;
  patientId: number;
  doctorId?: number;
  title: string;
  date: string;
  time?: string;
  place?: string;
  notes?: string;
  createdAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class AppointmentsService {
  private endpoint = '/appointments';

  constructor(private apiService: ApiService) {}

  /**
   * Get all appointments for a patient
   */
  getAppointments(patientId: number): Observable<Appointment[]> {
    return this.apiService.get<Appointment[]>(`${this.endpoint}/${patientId}`);
  }

  /**
   * Create a new appointment
   */
  createAppointment(appointment: Omit<Appointment, 'id' | 'createdAt'>): Observable<Appointment> {
    return this.apiService.post<Appointment>(this.endpoint, appointment);
  }

  /**
   * Update an appointment
   */
  updateAppointment(appointmentId: number, appointment: Partial<Appointment>): Observable<Appointment> {
    return this.apiService.put<Appointment>(`${this.endpoint}/${appointmentId}`, appointment);
  }

  /**
   * Delete an appointment
   */
  deleteAppointment(appointmentId: number): Observable<{ message: string }> {
    return this.apiService.delete<{ message: string }>(`${this.endpoint}/${appointmentId}`);
  }
}
