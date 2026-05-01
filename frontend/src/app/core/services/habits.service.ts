import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface HabitLog {
  id: number;
  patientId: number;
  habitType: string;
  value: number;
  notes?: string;
  loggedDate: string;
  createdAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class HabitsService {
  private apiUrl = 'http://localhost:3000/api/habits';

  constructor(private http: HttpClient) {}

  /**
   * Obtener todos los hábitos de un paciente
   */
  getHabits(patientId: number): Observable<HabitLog[]> {
    return this.http.get<HabitLog[]>(`${this.apiUrl}/${patientId}`);
  }

  /**
   * Obtener hábitos de un tipo específico
   */
  getHabitsByType(patientId: number, habitType: string): Observable<HabitLog[]> {
    return this.http.get<HabitLog[]>(`${this.apiUrl}/${patientId}/type/${habitType}`);
  }

  /**
   * Crear un nuevo hábito
   */
  createHabit(habit: Omit<HabitLog, 'id' | 'createdAt'>): Observable<HabitLog> {
    return this.http.post<HabitLog>(this.apiUrl, habit);
  }

  /**
   * Actualizar un hábito
   */
  updateHabit(id: number, updates: Partial<HabitLog>): Observable<HabitLog> {
    return this.http.put<HabitLog>(`${this.apiUrl}/${id}`, updates);
  }

  /**
   * Eliminar un hábito
   */
  deleteHabit(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
