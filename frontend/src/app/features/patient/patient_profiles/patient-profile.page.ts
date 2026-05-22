import { CommonModule } from "@angular/common";
import { Component, computed, DestroyRef, inject, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router, RouterModule } from "@angular/router";
import { Appointment, AppointmentsService } from "@core/services/appointments.service";
import { AuthService, CurrentUser } from "@core/services/auth.service";
import { HabitLog, HabitsService } from "@core/services/habits.service";
import { MedicationAlarm, MedicationsService } from "@core/services/medications.service";
import { ReportListItem, ReportsService } from "@core/services/reports.service";
import { LoadingSpinnerComponent } from "@shared/components/loading-spinner/loading-spinner.component";
import { forkJoin, of } from "rxjs";
import { catchError, finalize } from "rxjs/operators";

type TokenPayload = {
  userId?: number;
  patientId?: number | null;
  dni?: string;
  role?: string;
};

@Component({
  selector: "app-patient-profile-page",
  standalone: true,
  imports: [CommonModule, RouterModule, LoadingSpinnerComponent],
  templateUrl: "./patient-profile.page.html",
  styleUrls: ["./patient-profile.page.scss"],
})
export class PatientProfilePage implements OnInit {
  private authService = inject(AuthService);
  private habitsService = inject(HabitsService);
  private appointmentsService = inject(AppointmentsService);
  private medicationsService = inject(MedicationsService);
  private reportsService = inject(ReportsService);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);

  user = signal<CurrentUser | null>(null);
  tokenPayload = signal<TokenPayload | null>(null);
  habits = signal<HabitLog[]>([]);
  appointments = signal<Appointment[]>([]);
  medications = signal<MedicationAlarm[]>([]);
  reports = signal<ReportListItem[]>([]);
  isLoading = signal(false);
  loadingError = signal<string | null>(null);

  patientId = computed(() => {
    const payload = this.tokenPayload();
    return payload?.patientId || payload?.userId || null;
  });

  displayName = computed(() => {
    const user = this.user();
    return user?.fullName || user?.full_name || "Mi perfil";
  });

  initials = computed(() =>
    this.displayName()
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "P",
  );

  nextAppointment = computed(() =>
    this.appointments()
      .filter((appointment) => this.toTime(appointment.date) >= this.startOfToday())
      .sort((a, b) => this.toTime(a.date) - this.toTime(b.date))[0] || null,
  );

  signedReports = computed(
    () => this.reports().filter((report) => report.status === "signed").length,
  );

  lastHabitLabel = computed(() => {
    const latest = [...this.habits()].sort(
      (a, b) => this.toTime(b.loggedDate) - this.toTime(a.loggedDate),
    )[0];
    return latest ? this.formatDate(latest.loggedDate) : "Sin registros";
  });

  habitSummary = computed(() => {
    const definitions = [
      { key: "SLEEP", label: "Sueño", unit: "h" },
      { key: "EXERCISE", label: "Ejercicio", unit: "h" },
      { key: "NUTRITION", label: "Alimentación", unit: "pts" },
      { key: "STRESS", label: "Estrés", unit: "nivel" },
    ];

    return definitions.map((definition) => {
      const values = this.habits()
        .filter((habit) => habit.habitType === definition.key)
        .map((habit) => Number(habit.value))
        .filter((value) => Number.isFinite(value));
      const average = this.average(values);

      return {
        ...definition,
        count: values.length,
        average: average === null ? "Sin datos" : `${this.formatNumber(average)} ${definition.unit}`,
      };
    });
  });

  ngOnInit(): void {
    this.tokenPayload.set(this.decodeToken());
    this.authService
      .getCurrentUser()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => this.user.set(user));

    this.loadProfileData();
  }

  loadProfileData(): void {
    const patientId = this.patientId();
    if (!patientId) {
      this.loadingError.set("No se pudo identificar el perfil de paciente.");
      return;
    }

    this.isLoading.set(true);
    this.loadingError.set(null);

    forkJoin({
      habits: this.habitsService.getHabits(patientId).pipe(catchError(() => of([]))),
      appointments: this.appointmentsService.getAppointments(patientId).pipe(catchError(() => of([]))),
      medications: this.medicationsService.getMedicationAlarms(patientId).pipe(catchError(() => of([]))),
      reports: this.reportsService.listReports().pipe(catchError(() => of([]))),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: ({ habits, appointments, medications, reports }) => {
          this.habits.set(habits);
          this.appointments.set(appointments);
          this.medications.set(medications);
          this.reports.set(reports);
        },
        error: () => this.loadingError.set("No se pudo cargar el perfil."),
      });
  }

  goTo(path: string): void {
    this.router.navigate([path]);
  }

  formatAppointment(appointment: Appointment | null): string {
    if (!appointment) return "Sin citas próximas";
    const time = appointment.time ? ` · ${appointment.time}` : "";
    return `${this.formatDate(appointment.date)}${time}`;
  }

  trackByKey(_: number, item: { key: string }): string {
    return item.key;
  }

  private decodeToken(): TokenPayload | null {
    const token = this.authService.getToken();
    if (!token) return null;

    try {
      const payload = token.split(".")[1];
      return JSON.parse(atob(payload)) as TokenPayload;
    } catch (error) {
      console.error("Error decoding token:", error);
      return null;
    }
  }

  private average(values: number[]): number | null {
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private formatNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  private formatDate(date: string): string {
    const parsed = this.parseCalendarDate(date);
    if (Number.isNaN(parsed.getTime())) return "Sin fecha";
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(parsed);
  }

  private toTime(date: string): number {
    const parsed = this.parseCalendarDate(date);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  private parseCalendarDate(date: string): Date {
    const match = date?.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return new Date(date);
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  private startOfToday(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime();
  }
}
