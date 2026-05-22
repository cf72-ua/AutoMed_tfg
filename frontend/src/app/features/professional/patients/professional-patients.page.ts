import { CommonModule } from "@angular/common";
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import {
  Appointment,
  AppointmentsService,
} from "@core/services/appointments.service";
import { HabitLog, HabitsService } from "@core/services/habits.service";
import {
  MedicationAlarm,
  MedicationsService,
} from "@core/services/medications.service";
import {
  PatientInfo,
  ReportListItem,
  ReportsService,
} from "@core/services/reports.service";
import { LoadingSpinnerComponent } from "@shared/components/loading-spinner/loading-spinner.component";
import { forkJoin, of } from "rxjs";
import { catchError, finalize } from "rxjs/operators";

type HabitKey = "SLEEP" | "EXERCISE" | "NUTRITION" | "STRESS";

type EvolutionCard = {
  key: HabitKey;
  title: string;
  unit: string;
  average: string;
  latest: string;
  entries: number;
  points: number[];
  path: string;
  tone: "blue" | "green" | "amber" | "red";
};

type TimelineItem = {
  id: string;
  date: string;
  dateLabel: string;
  title: string;
  detail: string;
  kind: "habit" | "appointment" | "medication" | "report";
  badge: string;
};

@Component({
  selector: "app-professional-patients-page",
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingSpinnerComponent],
  templateUrl: "./professional-patients.page.html",
  styleUrls: ["./professional-patients.page.scss"],
})
export class ProfessionalPatientsPage implements OnInit {
  private reportsService = inject(ReportsService);
  private habitsService = inject(HabitsService);
  private appointmentsService = inject(AppointmentsService);
  private medicationsService = inject(MedicationsService);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);

  patients = signal<PatientInfo[]>([]);
  selectedPatientId = signal<number | null>(null);
  habits = signal<HabitLog[]>([]);
  appointments = signal<Appointment[]>([]);
  medications = signal<MedicationAlarm[]>([]);
  reports = signal<ReportListItem[]>([]);
  isLoadingPatients = signal(false);
  isLoadingDetail = signal(false);
  loadingError = signal<string | null>(null);
  searchText = "";

  filteredPatients(): PatientInfo[] {
    const search = this.normalize(this.searchText);

    return this.patients().filter((patient) => {
      return (
        !search ||
        this.normalize(patient.fullName).includes(search) ||
        this.normalize(patient.dni).includes(search) ||
        this.normalize(patient.email).includes(search)
      );
    });
  }

  selectedPatient = computed(() => {
    const id = this.selectedPatientId();
    return this.patients().find((patient) => patient.id === id) || null;
  });

  signedReportsCount = computed(
    () => this.reports().filter((report) => report.status === "signed").length,
  );

  lastActivityLabel = computed(() => {
    const latest = this.timeline()[0]?.date;
    return latest ? this.formatDate(latest) : "Sin actividad";
  });

  evolutionCards = computed<EvolutionCard[]>(() => {
    const definitions: Array<{
      key: HabitKey;
      title: string;
      unit: string;
      tone: EvolutionCard["tone"];
    }> = [
      { key: "SLEEP", title: "Sueño", unit: "h", tone: "blue" },
      { key: "EXERCISE", title: "Ejercicio", unit: "h", tone: "green" },
      { key: "NUTRITION", title: "Alimentación", unit: "pts", tone: "amber" },
      { key: "STRESS", title: "Estrés", unit: "nivel", tone: "red" },
    ];

    return definitions.map((definition) => {
      const entries = this.habits()
        .filter((habit) => habit.habitType === definition.key)
        .sort((a, b) => this.toTime(a.loggedDate) - this.toTime(b.loggedDate));
      const points = entries
        .map((habit) => Number(habit.value))
        .filter((value) => Number.isFinite(value));
      const average = this.average(points);
      const latest = points.length ? points[points.length - 1] : null;

      return {
        ...definition,
        average:
          average === null ? "Sin datos" : `${this.formatNumber(average)} ${definition.unit}`,
        latest:
          latest === null ? "Sin datos" : `${this.formatNumber(latest)} ${definition.unit}`,
        entries: entries.length,
        points,
        path: this.pointsToPath(points),
      };
    });
  });

  timeline = computed<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    this.habits().forEach((habit) => {
      items.push({
        id: `habit-${habit.id}`,
        date: habit.loggedDate,
        dateLabel: this.formatDateShort(habit.loggedDate),
        title: this.habitLabel(habit.habitType),
        detail: `${this.formatNumber(Number(habit.value))} ${this.habitUnit(habit.habitType)}`,
        kind: "habit",
        badge: "Hábito",
      });
    });

    this.appointments().forEach((appointment) => {
      items.push({
        id: `appointment-${appointment.id}`,
        date: appointment.date,
        dateLabel: this.formatDateShort(appointment.date),
        title: appointment.title || "Cita médica",
        detail: appointment.notes || appointment.place || "Seguimiento programado",
        kind: "appointment",
        badge: appointment.notes ? "Con notas" : "Cita",
      });
    });

    this.medications().forEach((medication) => {
      items.push({
        id: `medication-${medication.id}`,
        date: String(medication.createdAt || ""),
        dateLabel: this.formatDateShort(String(medication.createdAt || "")),
        title: medication.medicationName,
        detail: `${medication.dose} · ${medication.frequency} · ${medication.time}`,
        kind: "medication",
        badge: "Medicación",
      });
    });

    this.reports().forEach((report) => {
      items.push({
        id: `report-${report.id}`,
        date: String(report.createdAt),
        dateLabel: this.formatDateShort(String(report.createdAt)),
        title: report.title,
        detail: report.reportTypeName,
        kind: "report",
        badge: this.getStatusLabel(report.status),
      });
    });

    return items.sort((a, b) => this.toTime(b.date) - this.toTime(a.date));
  });

  recentTimeline = computed(() => this.timeline().slice(0, 7));
  recentReports = computed(() => this.reports().slice(0, 5));

  ngOnInit(): void {
    this.loadPatients();
  }

  loadPatients(): void {
    this.isLoadingPatients.set(true);
    this.loadingError.set(null);

    this.reportsService
      .getPatients()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingPatients.set(false)),
      )
      .subscribe({
        next: (patients) => {
          this.patients.set(patients);
          if (!this.selectedPatientId() && patients.length > 0) {
            this.selectPatient(patients[0].id);
          }
        },
        error: (error) => {
          console.error("Error loading professional patients:", error);
          this.loadingError.set("No se pudieron cargar los pacientes.");
        },
      });
  }

  selectPatient(patientId: number): void {
    if (this.selectedPatientId() === patientId && !this.loadingError()) return;

    this.selectedPatientId.set(patientId);
    this.isLoadingDetail.set(true);
    this.loadingError.set(null);

    forkJoin({
      habits: this.habitsService.getHabits(patientId).pipe(catchError(() => of([]))),
      appointments: this.appointmentsService
        .getAppointments(patientId)
        .pipe(catchError(() => of([]))),
      medications: this.medicationsService
        .getMedicationAlarms(patientId)
        .pipe(catchError(() => of([]))),
      reports: this.reportsService
        .listPatientReports(patientId)
        .pipe(catchError(() => of([]))),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingDetail.set(false)),
      )
      .subscribe(({ habits, appointments, medications, reports }) => {
        this.habits.set(habits);
        this.appointments.set(appointments);
        this.medications.set(medications);
        this.reports.set(reports);
      });
  }

  clearFilters(): void {
    this.searchText = "";
  }

  patientInitials(patient: PatientInfo): string {
    return patient.fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }

  patientAge(patient: PatientInfo | null): string {
    if (!patient?.dateOfBirth) return "No registrada";

    const birthDate = new Date(patient.dateOfBirth);
    if (Number.isNaN(birthDate.getTime())) return "No registrada";

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const hasBirthdayPassed =
      today.getMonth() > birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() &&
        today.getDate() >= birthDate.getDate());

    if (!hasBirthdayPassed) age -= 1;
    return `${age} años`;
  }

  riskLevel(patientId = this.selectedPatientId()): string {
    if (!patientId || this.selectedPatientId() !== patientId) return "";

    const stressValues = this.habits()
      .filter((habit) => habit.habitType === "STRESS")
      .map((habit) => Number(habit.value))
      .filter((value) => Number.isFinite(value));
    const stressAverage = this.average(stressValues);

    if (stressAverage !== null && stressAverage >= 7) return "high";
    if (this.medications().length > 0 || this.appointments().length >= 3) {
      return "medium";
    }
    return "low";
  }

  riskLabel(level = this.riskLevel()): string {
    const labels: Record<string, string> = {
      high: "Seguimiento alto",
      medium: "Seguimiento medio",
      low: "Estable",
    };
    return labels[level] || "Sin clasificar";
  }

  riskClass(level = this.riskLevel()): string {
    return `risk-${level || "none"}`;
  }

  viewReport(reportId: number): void {
    this.router.navigate(["/reports", reportId]);
  }

  createReport(): void {
    this.router.navigate(["/reports/new"], {
      queryParams: { patientId: this.selectedPatientId() },
    });
  }

  trackById(_: number, item: { id: number | string }): number | string {
    return item.id;
  }

  trackByKey(_: number, item: { key: string }): string {
    return item.key;
  }

  calculateCx(points: number[], index: number): number {
    const left = 8;
    const right = 212;
    if (points.length <= 1) return (left + right) / 2;
    return left + ((right - left) / (points.length - 1)) * index;
  }

  calculateCy(points: number[], index: number): number {
    if (points.length === 0) return 44;
    const max = Math.max(...points);
    const min = Math.min(...points);
    const range = max - min || 1;
    return 78 - ((points[index] - min) / range) * 62;
  }

  private pointsToPath(points: number[]): string {
    return points
      .map((_, index) => `${this.calculateCx(points, index)},${this.calculateCy(points, index)}`)
      .join(" ");
  }

  private normalize(value: string | null | undefined): string {
    return (value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  private average(values: number[]): number | null {
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private formatNumber(value: number): string {
    if (!Number.isFinite(value)) return "0";
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

  private formatDateShort(date: string): string {
    const parsed = this.parseCalendarDate(date);
    if (Number.isNaN(parsed.getTime())) return "S/F";
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "short",
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

  private habitLabel(habitType: string): string {
    const labels: Record<string, string> = {
      SLEEP: "Sueño",
      EXERCISE: "Ejercicio",
      NUTRITION: "Alimentación",
      STRESS: "Estrés",
    };
    return labels[habitType] || habitType;
  }

  private habitUnit(habitType: string): string {
    const units: Record<string, string> = {
      SLEEP: "h",
      EXERCISE: "h",
      NUTRITION: "pts",
      STRESS: "nivel",
    };
    return units[habitType] || "";
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      draft: "Borrador",
      signed: "Firmado",
      archived: "Archivado",
    };
    return labels[status] || status;
  }
}
