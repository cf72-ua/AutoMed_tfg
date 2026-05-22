import { CommonModule } from "@angular/common";
import {
  Component,
  computed,
  signal,
  inject,
  OnInit,
  DestroyRef,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  AppointmentsService,
  Appointment,
  PatientInfo,
} from "@core/services/appointments.service";
import {
  MedicationsService,
  MedicationAlarm,
} from "@core/services/medications.service";
import { AuthService } from "@core/services/auth.service";

type UserRole = "PACIENTE" | "DOCTOR" | "ADMIN" | null;

type CalendarEventType = "CONSULTA" | "MEDICACION";

type CalendarEvent = {
  id: string | number;
  type: CalendarEventType;
  title: string;
  date: string;
  time?: string;
  endDate?: string;
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
  nextDate: Date;
  endDateLabel: string;
};

interface TokenPayload {
  userId?: number;
  patientId?: number;
  role?: UserRole;
  iat?: number;
  exp?: number;
}

@Component({
  selector: "app-calendar-page",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./calendar.page.html",
  styleUrls: ["./calendar.page.scss"],
})
export class CalendarPage implements OnInit {
  private appointmentsService = inject(AppointmentsService);
  private medicationsService = inject(MedicationsService);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  
  currentUserId = signal<number | null>(null);
  currentRole = signal<UserRole>(null);
  currentPatientId = signal<number | null>(null);

  
  selectedPatientId = signal<number | null>(null);
  availablePatients = signal<PatientInfo[]>([]);

  
  private today = new Date();
  viewYear = signal<number>(this.today.getFullYear());
  viewMonth = signal<number>(this.today.getMonth());

  
  appointmentsData = signal<Appointment[]>([]);
  medicationsData = signal<MedicationAlarm[]>([]);

  
  isLoading = signal<boolean>(false);
  loadingError = signal<string | null>(null);

  
  showAppointmentForm = signal<boolean>(false);
  showMedicationForm = signal<boolean>(false);

  
  appointmentForm = signal({
    title: "",
    date: "",
    time: "",
    place: "",
    notes: "",
    patientId: "",
  });

  medicationForm = signal({
    medicationName: "",
    dose: "",
    frequency: "daily" as const,
    time: "",
    endDate: "",
    patientId: "",
  });

  
  events = computed<CalendarEvent[]>(() => {
    const appointments = this.appointmentsData().map((a) => ({
      id: a.id,
      type: "CONSULTA" as CalendarEventType,
      title: a.title,
      date: this.parseDateSafe(a.date),
      time: a.time,
    }));

    const medications = this.medicationsData()
      .map((m): CalendarEvent | null => {
        const nextDate = this.getNextMedicationDate(m);
        if (!nextDate) return null;

        return {
          id: m.id,
          type: "MEDICACION" as CalendarEventType,
          title: `${m.medicationName} (${m.dose})`,
          date: this.toDateStr(
            nextDate.getFullYear(),
            nextDate.getMonth(),
            nextDate.getDate(),
          ),
          time: m.time,
        };
      })
      .filter((event): event is CalendarEvent => event !== null);

    return [...appointments, ...medications];
  });

  upcoming = computed<AppointmentDisplay[]>(() => {
    const today = this.toDateStr(
      this.today.getFullYear(),
      this.today.getMonth(),
      this.today.getDate(),
    );

    return this.appointmentsData()
      .filter((appointment) => this.parseDateSafe(appointment.date) >= today)
      .sort((a, b) => {
        
        const dateA = this.parseDateSafe(a.date);
        const dateB = this.parseDateSafe(b.date);
        return dateA.localeCompare(dateB);
      })
      .slice(0, 5)
      .map((a) => ({
        id: a.id,
        title: a.title,
        dateLabel: this.formatDateLabel(a.date, a.time),
        doctor: "Doctor",
        place: a.place || "Por confirmar",
        time: a.time,
      }));
  });

  alarms = computed<MedicationDisplay[]>(() => {
    return this.medicationsData()
      .map((m) => {
        const nextDate = this.getNextMedicationDate(m);
        if (!nextDate) return null;

        return {
          id: m.id,
          name: m.medicationName,
          dose: m.dose,
          timeLabel: this.formatNextMedicationDate(nextDate),
          nextDate,
          endDateLabel: this.formatMedicationEndDate(m.endDate),
        };
      })
      .filter((alarm): alarm is MedicationDisplay => alarm !== null)
      .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());
  });

  monthLabel = computed(() => {
    const d = new Date(this.viewYear(), this.viewMonth(), 1);
    return d
      .toLocaleDateString("es-ES", { month: "long", year: "numeric" })
      .replace(/^\w/, (c) => c.toUpperCase());
  });

  monthOptions = computed(() => {
    const y = this.viewYear();
    return Array.from({ length: 12 }).map((_, m) => ({
      value: m,
      label: new Date(y, m, 1)
        .toLocaleDateString("es-ES", { month: "long" })
        .replace(/^\w/, (c) => c.toUpperCase()),
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

    const weeks: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  });

  constructor() {
    
    const token = localStorage.getItem("auth_token");
    if (token) {
      try {
        const parts = token.split(".");
        let payload = parts[1];
        const padding = 4 - (payload.length % 4);
        if (padding !== 4) {
          payload += "=".repeat(padding);
        }
        const decoded = JSON.parse(atob(payload)) as TokenPayload;

        
        if (decoded.userId) {
          this.currentUserId.set(decoded.userId);
        }
        if (decoded.role) {
          this.currentRole.set(decoded.role);
        }

        
        if (decoded.patientId) {
          this.currentPatientId.set(decoded.patientId);
        }
      } catch (e) {
        console.error("Failed to extract user info from token", e);
      }
    }
  }

  ngOnInit() {
    if (this.currentRole() === "DOCTOR") {
      
      if (this.currentUserId()) {
        
        this.loadDoctorData();
      }
    } else if (this.currentRole() === "PACIENTE") {
      
      if (this.currentPatientId()) {
        this.loadPatientData();
      }
    }
  }

  private loadPatientData() {
    const patientId = this.currentPatientId();
    if (!patientId) return;

    this.isLoading.set(true);
    this.loadingError.set(null);

    this.appointmentsService
      .getAppointments(patientId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.appointmentsData.set(data);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error("Error loading appointments:", err);
          this.loadingError.set("Error cargando citas");
          this.isLoading.set(false);
        },
      });

    this.medicationsService
      .getMedicationAlarms(patientId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.medicationsData.set(data);
        },
        error: (err) => {
          console.error("Error loading medications:", err);
        },
      });
  }

  private loadDoctorData() {
    const doctorId = this.currentUserId();
    if (!doctorId) return;

    this.isLoading.set(true);
    this.loadingError.set(null);

    this.appointmentsService
      .getAppointmentsByDoctor(doctorId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.appointmentsData.set(data);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error("Error loading doctor appointments:", err);
          this.loadingError.set("Error cargando citas");
          this.isLoading.set(false);
        },
      });

    
    this.appointmentsService
      .getAllPatients()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (patients) => {
          this.availablePatients.set(patients);
        },
        error: (err) => {
          console.error("Error loading patients:", err);
        },
      });
  }

  /**
   * Filter appointments by patient (only for doctors)
   */
  filterByPatient(patientId: number) {
    const doctorId = this.currentUserId();
    if (!doctorId) return;

    this.selectedPatientId.set(patientId);
    this.isLoading.set(true);

    this.appointmentsService
      .getAppointmentsByDoctorAndPatient(doctorId, patientId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.appointmentsData.set(data);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error("Error filtering appointments:", err);
          this.loadingError.set("Error filtrando citas");
          this.isLoading.set(false);
        },
      });
  }

  /**
   * Clear patient filter (only for doctors)
   */
  clearPatientFilter() {
    this.selectedPatientId.set(null);
    this.loadDoctorData();
  }

  
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
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  /**
   * Parse a date string safely without timezone issues
   * Converts YYYY-MM-DD or ISO string to YYYY-MM-DD format
   * This ensures dates from the database are interpreted in local timezone
   */
  private parseDateSafe(dateStr: string): string {
    if (!dateStr) return "";

    if (dateStr.includes("T")) {
      const parsed = new Date(dateStr);
      if (!Number.isNaN(parsed.getTime())) {
        return this.toDateStr(
          parsed.getFullYear(),
          parsed.getMonth(),
          parsed.getDate(),
        );
      }
    }

    
    const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return dateStr;

    
    const year = match[1];
    const month = match[2];
    const day = match[3];

    return `${year}-${month}-${day}`;
  }

  eventsFor(dateStr?: string): CalendarEvent[] {
    if (!dateStr) return [];
    const targetDate = this.parseDateSafe(dateStr);
    return this.events().filter((e) => {
      const eventDate = this.parseDateSafe(e.date);
      return eventDate === targetDate;
    });
  }

  trackByIdx(index: number): number {
    return index;
  }

  private formatDateLabel(date: string, time?: string): string {
    try {
      
      const dateStr = this.parseDateSafe(date);
      const [year, month, day] = dateStr.split("-").map(Number);
      
      const dateObj = new Date(year, month - 1, day);

      if (isNaN(dateObj.getTime())) {
        return "Invalid date";
      }

      const formattedStr = dateObj.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const capitalizedDate = formattedStr.replace(/^\w/, (c) =>
        c.toUpperCase(),
      );
      return time ? `${capitalizedDate}, ${time}` : capitalizedDate;
    } catch (error) {
      console.error("Error formatting date:", date, error);
      return "Invalid date";
    }
  }

  
  openAppointmentForm() {
    this.showAppointmentForm.set(true);
  }

  closeAppointmentForm() {
    this.showAppointmentForm.set(false);
    this.appointmentForm.set({
      title: "",
      date: "",
      time: "",
      place: "",
      notes: "",
      patientId: "",
    });
  }

  submitAppointment() {
    if (this.currentRole() === "PACIENTE") {
      
      this.loadingError.set("Los pacientes no pueden crear citas");
      return;
    }

    const form = this.appointmentForm();
    let patientId = null;

    if (this.currentRole() === "DOCTOR") {
      
      patientId = form.patientId ? parseInt(form.patientId) : null;
      if (!patientId || !form.date) {
        this.loadingError.set("Debes seleccionar un paciente y una fecha");
        return;
      }
    }

    const doctorId =
      this.currentRole() === "DOCTOR" ? this.currentUserId() : undefined;

    
    
    const dateMatch = form.date.match(/(\d{4})-(\d{2})-(\d{2})/);
    const normalizedDate = dateMatch
      ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
      : form.date;

    this.appointmentsService
      .createAppointment({
        patientId: patientId || this.currentPatientId()!,
        doctorId: doctorId || undefined,
        title: form.title || "Cita médica",
        date: normalizedDate,
        time: form.time,
        place: form.place,
        notes: form.notes,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (newAppointment) => {
          this.appointmentsData.set([
            ...this.appointmentsData(),
            newAppointment,
          ]);
          this.closeAppointmentForm();
        },
        error: (err) => {
          console.error("Error creating appointment:", err);
          this.loadingError.set("Error creando cita");
        },
      });
  }

  deleteAppointment(appointmentId: number) {
    if (!confirm("¿Eliminar esta cita?")) return;

    this.appointmentsService
      .deleteAppointment(appointmentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.appointmentsData.set(
            this.appointmentsData().filter((a) => a.id !== appointmentId),
          );
        },
        error: (err) => {
          console.error("Error deleting appointment:", err);
          this.loadingError.set("Error eliminando cita");
        },
      });
  }

  
  openMedicationForm() {
    this.showMedicationForm.set(true);
  }

  closeMedicationForm() {
    this.showMedicationForm.set(false);
    this.medicationForm.set({
      medicationName: "",
      dose: "",
      frequency: "daily",
      time: "",
      endDate: "",
      patientId: "",
    });
  }

  submitMedication() {
    let patientId: number | null = null;

    if (this.currentRole() === "DOCTOR") {
      
      patientId = this.medicationForm().patientId
        ? parseInt(this.medicationForm().patientId)
        : null;
      if (!patientId) {
        this.loadingError.set("Debes seleccionar un paciente");
        return;
      }
    } else if (this.currentRole() === "PACIENTE") {
      
      patientId = this.currentPatientId();
    }

    if (
      !patientId ||
      !this.medicationForm().medicationName ||
      !this.medicationForm().dose ||
      !this.medicationForm().endDate ||
      !this.medicationForm().time
    ) {
      this.loadingError.set("Completa medicación, dosis, hora y fecha final");
      return;
    }

    const form = this.medicationForm();
    this.medicationsService
      .createMedicationAlarm({
        patientId: patientId,
        medicationName: form.medicationName,
        dose: form.dose,
        frequency: form.frequency,
        time: form.time,
        endDate: form.endDate,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (newAlarm) => {
          this.medicationsData.set([...this.medicationsData(), newAlarm]);
          this.closeMedicationForm();
        },
        error: (err) => {
          console.error("Error creating medication alarm:", err);
          this.loadingError.set("Error creando alarma");
        },
      });
  }

  private formatMedicationEndDate(endDate: string): string {
    if (!endDate) return "Sin fecha final";
    return `Hasta ${this.formatDateLabel(endDate)}`;
  }

  private getNextMedicationDate(medication: MedicationAlarm): Date | null {
    const now = new Date();
    const endDate = this.parseLocalDate(medication.endDate);
    if (Number.isNaN(endDate.getTime())) return null;
    endDate.setHours(23, 59, 59, 999);

    const [hour, minute] = this.parseMedicationTime(medication.time);
    const startDate = medication.createdAt
      ? new Date(medication.createdAt)
      : new Date();

    if (medication.frequency === "as_needed") {
      const candidate = new Date(now);
      candidate.setHours(hour, minute, 0, 0);
      return candidate > now && candidate <= endDate ? candidate : null;
    }

    const intervalDays = medication.frequency === "weekly" ? 7 : 1;
    const candidate = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      hour,
      minute,
      0,
      0,
    );

    while (candidate <= now) {
      candidate.setDate(candidate.getDate() + intervalDays);
    }

    return candidate <= endDate ? candidate : null;
  }

  private parseMedicationTime(time: string): [number, number] {
    const match = (time || "09:00").match(/(\d{1,2}):(\d{2})/);
    if (!match) return [9, 0];
    return [Number(match[1]), Number(match[2])];
  }

  private parseLocalDate(date: string): Date {
    const dateStr = this.parseDateSafe(date);
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  private formatNextMedicationDate(date: Date): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    const time = date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (dateOnly.getTime() === today.getTime()) return `Hoy, ${time}`;
    if (dateOnly.getTime() === tomorrow.getTime()) return `Mañana, ${time}`;

    return `${this.formatDateLabel(this.toDateStr(date.getFullYear(), date.getMonth(), date.getDate()))}, ${time}`;
  }

  deleteMedication(medicationId: number) {
    if (!confirm("¿Eliminar esta alarma de medicación?")) return;

    this.medicationsService
      .deleteMedicationAlarm(medicationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.medicationsData.set(
            this.medicationsData().filter((m) => m.id !== medicationId),
          );
        },
        error: (err) => {
          console.error("Error deleting medication alarm:", err);
          this.loadingError.set("Error eliminando alarma");
        },
      });
  }
}
