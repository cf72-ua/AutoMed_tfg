import { CommonModule } from '@angular/common';
import { Component, computed, signal, inject, OnInit, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppointmentsService, Appointment } from '@core/services/appointments.service';
import { MedicationsService, MedicationAlarm } from '@core/services/medications.service';
import { AuthService } from '@core/services/auth.service';

type CalendarEventType = 'CONSULTA' | 'MEDICACION';

type CalendarEvent = {
  id: string | number;
  type: CalendarEventType;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // "10:00"
  endDate?: string; // para eventos que duran varios días
};

type AppointmentDisplay = {
  id: number;
  title: string;
  dateLabel: string;
  doctor: string;
  place: string;
  time?: string;
};

type MedicationDisplay = {
  id: number;
  name: string;
  dose: string;
  timeLabel: string;
};

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar.page.html',
  styleUrls: ['./calendar.page.scss'],
})
export class CalendarPage implements OnInit {
  private appointmentsService = inject(AppointmentsService);
  private medicationsService = inject(MedicationsService);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  // Current user
  currentPatientId = signal<number | null>(null);

  // Mes visible (0-11)
  private today = new Date();
  viewYear = signal<number>(this.today.getFullYear());
  viewMonth = signal<number>(this.today.getMonth());

  // Raw data
  appointmentsData = signal<Appointment[]>([]);
  medicationsData = signal<MedicationAlarm[]>([]);

  // Loading states
  isLoading = signal<boolean>(false);
  loadingError = signal<string | null>(null);

  // Modal/Form states
  showAppointmentForm = signal<boolean>(false);
  showMedicationForm = signal<boolean>(false);
  
  // Form data
  appointmentForm = signal({
    title: '',
    date: '',
    time: '',
    place: '',
    notes: ''
  });

  medicationForm = signal({
    medicationName: '',
    dose: '',
    frequency: 'daily' as const,
    time: ''
  });

  // Computed properties
  events = computed<CalendarEvent[]>(() => {
    const appointments = this.appointmentsData().map(a => ({
      id: a.id,
      type: 'CONSULTA' as CalendarEventType,
      title: a.title,
      date: typeof a.date === 'string' ? a.date.split('T')[0] : a.date,
      time: a.time
    }));

    const medications = this.medicationsData().map(m => ({
      id: m.id,
      type: 'MEDICACION' as CalendarEventType,
      title: `${m.medicationName} (${m.dose})`,
      date: this.today.toISOString().split('T')[0], // Today for simplicity
      time: m.time
    }));

    return [...appointments, ...medications];
  });

  upcoming = computed<AppointmentDisplay[]>(() => {
    return this.appointmentsData()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5)
      .map(a => ({
        id: a.id,
        title: a.title,
        dateLabel: this.formatDateLabel(a.date, a.time),
        doctor: 'Doctor',
        place: a.place || 'Por confirmar',
        time: a.time
      }));
  });

  alarms = computed<MedicationDisplay[]>(() => {
    return this.medicationsData().map(m => ({
      id: m.id,
      name: m.medicationName,
      dose: m.dose,
      timeLabel: m.time
    }));
  });

  monthLabel = computed(() => {
    const d = new Date(this.viewYear(), this.viewMonth(), 1);
    return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
      .replace(/^\w/, (c) => c.toUpperCase());
  });

  monthOptions = computed(() => {
    const y = this.viewYear();
    return Array.from({ length: 12 }).map((_, m) => ({
      value: m,
      label: new Date(y, m, 1).toLocaleDateString('es-ES', { month: 'long' }).replace(/^\w/, (c) => c.toUpperCase()),
    }));
  });

  monthGrid = computed(() => {
    const year = this.viewYear();
    const month = this.viewMonth();

    const first = new Date(year, month, 1);
    const startDay = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: { day: number | null; dateStr?: string }[] = [];
    for (let i = 0; i < startDay; i++) cells.push({ day: null });

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = this.toDateStr(year, month, d);
      cells.push({ day: d, dateStr });
    }

    while (cells.length % 7 !== 0) cells.push({ day: null });
    while (cells.length < 42) cells.push({ day: null });

    const weeks: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  });

  constructor() {
    // Extract patient ID from JWT token
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        const parts = token.split('.');
        let payload = parts[1];
        const padding = 4 - (payload.length % 4);
        if (padding !== 4) {
          payload += '='.repeat(padding);
        }
        const decoded = JSON.parse(atob(payload)) as any;
        if (decoded.patientId) {
          this.currentPatientId.set(decoded.patientId);
        }
      } catch (e) {
        console.error('Failed to extract patient ID from token', e);
      }
    }
  }

  ngOnInit() {
    if (this.currentPatientId()) {
      this.loadData();
    }
  }

  private loadData() {
    const patientId = this.currentPatientId();
    if (!patientId) return;

    this.isLoading.set(true);
    this.loadingError.set(null);

    this.appointmentsService.getAppointments(patientId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.appointmentsData.set(data);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error loading appointments:', err);
          this.loadingError.set('Error cargando citas');
          this.isLoading.set(false);
        }
      });

    this.medicationsService.getMedicationAlarms(patientId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.medicationsData.set(data);
        },
        error: (err) => {
          console.error('Error loading medications:', err);
        }
      });
  }

  // Calendar navigation
  prevMonth() {
    if (this.viewMonth() === 0) {
      this.viewYear.set(this.viewYear() - 1);
      this.viewMonth.set(11);
    } else {
      this.viewMonth.set(this.viewMonth() - 1);
    }
  }

  nextMonth() {
    if (this.viewMonth() === 11) {
      this.viewYear.set(this.viewYear() + 1);
      this.viewMonth.set(0);
    } else {
      this.viewMonth.set(this.viewMonth() + 1);
    }
  }

  setMonth(month: number) {
    this.viewMonth.set(month);
  }

  toDateStr(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  eventsFor(dateStr?: string): CalendarEvent[] {
    if (!dateStr) return [];
    return this.events().filter(e => {
      // Extract date part from ISO format (YYYY-MM-DD)
      const eventDate = typeof e.date === 'string' ? e.date.split('T')[0] : e.date;
      return eventDate === dateStr;
    });
  }

  trackByIdx(index: number): number {
    return index;
  }

  private formatDateLabel(date: string, time?: string): string {
    try {
      // Handle both ISO format (2026-04-19T22:00:00.000Z) and simple date format (2026-04-20)
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return 'Invalid date';
      }
      
      const dateStr = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const capitalizedDate = dateStr.replace(/^\w/, (c) => c.toUpperCase());
      return time ? `${capitalizedDate}, ${time}` : capitalizedDate;
    } catch (error) {
      console.error('Error formatting date:', date, error);
      return 'Invalid date';
    }
  }

  // Appointment form handling
  openAppointmentForm() {
    this.showAppointmentForm.set(true);
  }

  closeAppointmentForm() {
    this.showAppointmentForm.set(false);
    this.appointmentForm.set({
      title: '',
      date: '',
      time: '',
      place: '',
      notes: ''
    });
  }

  submitAppointment() {
    const patientId = this.currentPatientId();
    if (!patientId || !this.appointmentForm().date) return;

    const form = this.appointmentForm();
    this.appointmentsService.createAppointment({
      patientId: patientId,
      title: form.title || 'Cita médica',
      date: form.date,
      time: form.time,
      place: form.place,
      notes: form.notes
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (newAppointment) => {
          this.appointmentsData.set([...this.appointmentsData(), newAppointment]);
          this.closeAppointmentForm();
        },
        error: (err) => {
          console.error('Error creating appointment:', err);
          this.loadingError.set('Error creando cita');
        }
      });
  }

  deleteAppointment(appointmentId: number) {
    if (!confirm('¿Eliminar esta cita?')) return;

    this.appointmentsService.deleteAppointment(appointmentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.appointmentsData.set(
            this.appointmentsData().filter(a => a.id !== appointmentId)
          );
        },
        error: (err) => {
          console.error('Error deleting appointment:', err);
          this.loadingError.set('Error eliminando cita');
        }
      });
  }

  // Medication form handling
  openMedicationForm() {
    this.showMedicationForm.set(true);
  }

  closeMedicationForm() {
    this.showMedicationForm.set(false);
    this.medicationForm.set({
      medicationName: '',
      dose: '',
      frequency: 'daily',
      time: ''
    });
  }

  submitMedication() {
    const patientId = this.currentPatientId();
    if (!patientId || !this.medicationForm().medicationName || !this.medicationForm().time) return;

    const form = this.medicationForm();
    this.medicationsService.createMedicationAlarm({
      patientId: patientId,
      medicationName: form.medicationName,
      dose: form.dose,
      frequency: form.frequency,
      time: form.time
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (newAlarm) => {
          this.medicationsData.set([...this.medicationsData(), newAlarm]);
          this.closeMedicationForm();
        },
        error: (err) => {
          console.error('Error creating medication alarm:', err);
          this.loadingError.set('Error creando alarma');
        }
      });
  }

  deleteMedication(medicationId: number) {
    if (!confirm('¿Eliminar esta alarma de medicación?')) return;

    this.medicationsService.deleteMedicationAlarm(medicationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.medicationsData.set(
            this.medicationsData().filter(m => m.id !== medicationId)
          );
        },
        error: (err) => {
          console.error('Error deleting medication alarm:', err);
          this.loadingError.set('Error eliminando alarma');
        }
      });
  }
}