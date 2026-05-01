import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface MedicationAlarm {
  id: number;
  patientId: number;
  medicationName: string;
  dose: string;
  frequency: string;
  time: string;
  notes?: string;
  createdAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class MedicationsService {
  private endpoint = '/medications';

  constructor(private apiService: ApiService) {}

  /**
   * Get all medication alarms for a patient
   */
  getMedicationAlarms(patientId: number): Observable<MedicationAlarm[]> {
    return this.apiService.get<MedicationAlarm[]>(`${this.endpoint}/${patientId}`);
  }

  /**
   * Create a new medication alarm
   */
  createMedicationAlarm(alarm: Omit<MedicationAlarm, 'id' | 'createdAt'>): Observable<MedicationAlarm> {
    return this.apiService.post<MedicationAlarm>(this.endpoint, alarm);
  }

  /**
   * Update a medication alarm
   */
  updateMedicationAlarm(alarmId: number, alarm: Partial<MedicationAlarm>): Observable<MedicationAlarm> {
    return this.apiService.put<MedicationAlarm>(`${this.endpoint}/${alarmId}`, alarm);
  }

  /**
   * Delete a medication alarm
   */
  deleteMedicationAlarm(alarmId: number): Observable<{ message: string }> {
    return this.apiService.delete<{ message: string }>(`${this.endpoint}/${alarmId}`);
  }
}
