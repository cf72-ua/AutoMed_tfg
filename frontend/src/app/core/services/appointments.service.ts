import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { ApiService } from "./api.service";

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

export interface PatientInfo {
  id: number;
  name: string;
}

@Injectable({
  providedIn: "root",
})
export class AppointmentsService {
  private endpoint = "/appointments";

  constructor(private apiService: ApiService) {}

  /**
   * Get all appointments for a patient
   */
  getAppointments(patientId: number): Observable<Appointment[]> {
    return this.apiService
      .get<Appointment[]>(`${this.endpoint}/${patientId}`)
      .pipe(
        map((appointments) =>
          appointments.map((appointment) =>
            this.normalizeAppointment(appointment),
          ),
        ),
      );
  }

  /**
   * Get all appointments for a doctor
   */
  getAppointmentsByDoctor(doctorId: number): Observable<Appointment[]> {
    return this.apiService
      .get<Appointment[]>(`${this.endpoint}/doctor/${doctorId}`)
      .pipe(
        map((appointments) =>
          appointments.map((appointment) =>
            this.normalizeAppointment(appointment),
          ),
        ),
      );
  }

  /**
   * Get all patients in the system
   */
  getAllPatients(): Observable<PatientInfo[]> {
    return this.apiService.get<PatientInfo[]>(`${this.endpoint}/patients/all`);
  }

  /**
   * Get patients treated by a doctor
   */
  getPatientsByDoctor(doctorId: number): Observable<PatientInfo[]> {
    return this.apiService.get<PatientInfo[]>(
      `${this.endpoint}/doctor/${doctorId}/patients`,
    );
  }

  /**
   * Get appointments for a doctor filtered by patient
   */
  getAppointmentsByDoctorAndPatient(
    doctorId: number,
    patientId: number,
  ): Observable<Appointment[]> {
    return this.apiService
      .get<
        Appointment[]
      >(`${this.endpoint}/doctor/${doctorId}/patient/${patientId}`)
      .pipe(
        map((appointments) =>
          appointments.map((appointment) =>
            this.normalizeAppointment(appointment),
          ),
        ),
      );
  }

  /**
   * Create a new appointment
   */
  createAppointment(
    appointment: Omit<Appointment, "id" | "createdAt">,
  ): Observable<Appointment> {
    return this.apiService
      .post<Appointment>(this.endpoint, appointment)
      .pipe(
        map((createdAppointment) =>
          this.normalizeAppointment(createdAppointment),
        ),
      );
  }

  /**
   * Update an appointment
   */
  updateAppointment(
    appointmentId: number,
    appointment: Partial<Appointment>,
  ): Observable<Appointment> {
    return this.apiService
      .put<Appointment>(`${this.endpoint}/${appointmentId}`, appointment)
      .pipe(
        map((updatedAppointment) =>
          this.normalizeAppointment(updatedAppointment),
        ),
      );
  }

  /**
   * Delete an appointment
   */
  deleteAppointment(appointmentId: number): Observable<{ message: string }> {
    return this.apiService.delete<{ message: string }>(
      `${this.endpoint}/${appointmentId}`,
    );
  }

  private normalizeAppointment(appointment: Appointment): Appointment {
    return {
      ...appointment,
      date: this.normalizeDate(appointment.date),
    };
  }

  private normalizeDate(value: string): string {
    if (!value) return value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      const match = value.match(/(\d{4})-(\d{2})-(\d{2})/);
      return match ? `${match[1]}-${match[2]}-${match[3]}` : value;
    }

    return [
      parsed.getFullYear(),
      String(parsed.getMonth() + 1).padStart(2, "0"),
      String(parsed.getDate()).padStart(2, "0"),
    ].join("-");
  }
}
