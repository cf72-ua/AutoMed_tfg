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
import { HabitsService, HabitLog } from "@core/services/habits.service";
import {
  AppointmentsService,
  Appointment,
} from "@core/services/appointments.service";
import { AuthService } from "@core/services/auth.service";

type HabitCard = {
  key: "sleep" | "exercise" | "nutrition" | "stress";
  title: string;
  subtitle: string;
  emoji: string;
  unit: string;
  avg: string;
  max: string;
  min: string;
  points: number[];
  xLabels: string[];
  path: string;
  habitType: string;
  hasData: boolean;
};

type AxisTick = {
  label: string;
  y: number;
};

type TimelineKind = "HABITOS" | "CITA" | "SINTOMAS" | "PLAN";

type TimelineItem = {
  id: string | number;
  dateLabel: string;
  title: string;
  kind: TimelineKind;
  detail: string;
  badge?: { text: string; tone: "blue" | "green" | "amber" | "red" | "gray" };
  notes?: string;
  date?: string;
};

type UserRole = "PACIENTE" | "DOCTOR" | "ADMIN" | null;

@Component({
  selector: "app-evolution-page",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./evolution.page.html",
  styleUrls: ["./evolution.page.scss"],
})
export class EvolutionPage implements OnInit {
  private habitsService = inject(HabitsService);
  private appointmentsService = inject(AppointmentsService);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  
  currentPatientId = signal<number | null>(null);
  currentRole = signal<UserRole>(null);

  
  habitsData = signal<HabitLog[]>([]);
  appointmentsData = signal<Appointment[]>([]);
  isLoading = signal<boolean>(false);
  loadingError = signal<string | null>(null);

  
  showNotesModal = signal<boolean>(false);
  editingAppointmentId = signal<number | null>(null);
  editingNotes = signal<string>("");
  timelinePage = signal<number>(0);
  readonly timelinePageSize = 5;

  months = ["Ene", "Feb", "Mar", "Abr", "May"];

  cards = computed<HabitCard[]>(() => {
    const habits = this.habitsData();
    const habitTypes = ["SLEEP", "EXERCISE", "NUTRITION", "STRESS"];

    return habitTypes.map((type) => {
      const typeHabits = habits
        .filter((h) => h.habitType === type)
        .sort(
          (a, b) =>
            new Date(a.loggedDate).getTime() -
            new Date(b.loggedDate).getTime(),
        );
      const points = typeHabits
        .map((h) => this.toFiniteNumber(h.value))
        .filter((value) => value !== null) as number[];
      const xLabels =
        typeHabits.length > 0
          ? typeHabits.map((h) => this.formatDateShort(h.loggedDate))
          : ["", "", "", "", ""];
      const chartPoints = points.length > 0 ? points : [0, 0, 0, 0, 0];

      const avg =
        points.length > 0
          ? (points.reduce((a, b) => a + b, 0) / points.length).toFixed(1)
          : "0";
      const max = points.length > 0 ? Math.max(...points).toFixed(1) : "0";
      const min = points.length > 0 ? Math.min(...points).toFixed(1) : "0";

      const cardMap: Record<string, HabitCard> = {
        SLEEP: {
          key: "sleep",
          title: "Sueño",
          subtitle: "Horas de sueño",
          emoji: "🛏️",
          unit: "hrs / día",
          avg: `${avg} h`,
          max: `${max} h`,
          min: `${min} h`,
          habitType: "SLEEP",
          points: chartPoints,
          xLabels,
          path: this.pointsToPath(chartPoints),
          hasData: points.length > 0,
        },
        EXERCISE: {
          key: "exercise",
          title: "Ejercicio",
          subtitle: "Horas de actividad",
          emoji: "🏃",
          unit: "hrs / semana",
          avg: `${avg} h`,
          max: `${max} h`,
          min: `${min} h`,
          habitType: "EXERCISE",
          points: chartPoints,
          xLabels,
          path: this.pointsToPath(chartPoints),
          hasData: points.length > 0,
        },
        NUTRITION: {
          key: "nutrition",
          title: "Alimentación",
          subtitle: "Puntuación de nutrición",
          emoji: "🥗",
          unit: "score",
          avg: avg,
          max: max,
          min: min,
          habitType: "NUTRITION",
          points: chartPoints,
          xLabels,
          path: this.pointsToPath(chartPoints),
          hasData: points.length > 0,
        },
        STRESS: {
          key: "stress",
          title: "Estrés",
          subtitle: "Nivel de estrés",
          emoji: "🧘",
          unit: "nivel",
          avg: avg,
          max: max,
          min: min,
          habitType: "STRESS",
          points: chartPoints,
          xLabels,
          path: this.pointsToPath(chartPoints),
          hasData: points.length > 0,
        },
      };

      return cardMap[type];
    });
  });

  timeline = computed<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    
    this.habitsData().forEach((habit) => {
      const value = this.toFiniteNumber(habit.value);
      if (value === null) return;

      items.push({
        id: `habit-${habit.id}`,
        dateLabel: this.formatDateShort(habit.loggedDate),
        title: "Registro de Hábitos",
        kind: "HABITOS",
        detail: `${this.habitLabel(habit.habitType)}: ${this.formatHabitValue(value)} ${["SLEEP", "EXERCISE"].includes(habit.habitType) ? "h" : "puntos"}`,
        badge: { text: "OK", tone: "blue" },
        date: habit.loggedDate,
      });
    });

    
    this.appointmentsData().forEach((appt) => {
      items.push({
        id: `appt-${appt.id}`,
        dateLabel: this.formatDateShort(appt.date),
        title: appt.title || "Cita Médica",
        kind: "CITA",
        detail: appt.notes || "Cita programada",
        badge: appt.notes
          ? { text: "Completada", tone: "green" }
          : { text: "Pendiente", tone: "gray" },
        notes: appt.notes,
        date: appt.date,
      });
    });

    
    return items.sort((a, b) => {
      const dateA = a.date ? this.parseCalendarDate(a.date).getTime() : 0;
      const dateB = b.date ? this.parseCalendarDate(b.date).getTime() : 0;
      return dateB - dateA;
    });
  });

  paginatedTimeline = computed<TimelineItem[]>(() => {
    const page = Math.min(this.timelinePage(), this.totalTimelinePages() - 1);
    const safePage = Math.max(page, 0);
    const start = safePage * this.timelinePageSize;
    return this.timeline().slice(start, start + this.timelinePageSize);
  });

  totalTimelinePages = computed<number>(() =>
    Math.max(1, Math.ceil(this.timeline().length / this.timelinePageSize)),
  );

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
        const decoded = JSON.parse(atob(payload)) as {
          userId?: number;
          patientId?: number;
          role?: string;
        };
        if (decoded.userId) {
          
          if (decoded.patientId) {
            this.currentPatientId.set(decoded.patientId);
          }
        }
        if (decoded.role) {
          this.currentRole.set(decoded.role as UserRole);
        }
      } catch (e) {
        console.error("Failed to extract user info from token", e);
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

    
    this.habitsService
      .getHabits(patientId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.habitsData.set(data);
          this.ensureTimelinePageInRange();
        },
        error: (err) => {
          console.error("Error loading habits:", err);
          this.loadingError.set("Error cargando hábitos");
        },
      });

    
    this.appointmentsService
      .getAppointments(patientId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.appointmentsData.set(data);
          this.ensureTimelinePageInRange();
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error("Error loading appointments:", err);
          this.loadingError.set("Error cargando citas");
          this.isLoading.set(false);
        },
      });
  }

  private formatDateShort(dateStr: string): string {
    if (!dateStr) return "";

    const months = [
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ];

    const isoDateMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDateMatch) {
      const month = Number(isoDateMatch[2]);
      const day = Number(isoDateMatch[3]);
      if (Number.isFinite(month) && Number.isFinite(day) && months[month - 1]) {
        return `${months[month - 1]} ${day}`;
      }
    }

    const parsedDate = this.parseCalendarDate(dateStr);
    if (!Number.isNaN(parsedDate.getTime())) {
      return `${months[parsedDate.getMonth()]} ${parsedDate.getDate()}`;
    }

      return dateStr;
  }

  private parseCalendarDate(dateStr: string): Date {
    const match = dateStr?.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return new Date(dateStr);
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  pointsToPath(points: number[]): string {
    if (points.length === 0) return "";

    return points
      .map((p, i) => {
        const x = this.calculateCx(points, i);
        const y = this.calculateCy(points, i);
        return `${x},${y}`;
      })
      .join(" ");
  }

  calculateCx(points: number[], index: number): number {
    const left = 34;
    const right = 270;
    if (points.length <= 1) return (left + right) / 2;
    return left + ((right - left) / (points.length - 1)) * index;
  }

  calculateCy(points: number[], index: number): number {
    if (points.length === 0 || index < 0 || index >= points.length) return 100;
    return this.valueToChartY(points[index], points);
  }

  yAxisTicks(points: number[]): AxisTick[] {
    const validPoints = points.filter((point) => Number.isFinite(point));
    const axisPoints = validPoints.length > 0 ? validPoints : [0, 10];
    const minValue = Math.min(...axisPoints);
    const maxValue = Math.max(...axisPoints);
    const middleValue = minValue + (maxValue - minValue) / 2;

    return [maxValue, middleValue, minValue].map((value) => ({
      label: this.formatHabitValue(value),
      y: this.valueToChartY(value, axisPoints),
    }));
  }

  private valueToChartY(value: number, points: number[]): number {
    const top = 14;
    const bottom = 102;
    const maxValue = Math.max(...points);
    const minValue = Math.min(...points);
    const range = maxValue - minValue || 1;

    const y = bottom - ((value - minValue) / range) * (bottom - top);
    return Number.isFinite(y) ? y : bottom;
  }

  private toFiniteNumber(value: unknown): number | null {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  private formatHabitValue(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
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

  iconFor(kind: TimelineKind): string {
    const icons: Record<TimelineKind, string> = {
      HABITOS: "📊",
      CITA: "🏥",
      SINTOMAS: "🤒",
      PLAN: "📋",
    };
    return icons[kind] || "📌";
  }

  badgeClass(tone: string): string {
    const toneMap: Record<string, string> = {
      blue: "badge-blue",
      green: "badge-green",
      amber: "badge-amber",
      red: "badge-red",
      gray: "badge-gray",
    };
    return `badge ${toneMap[tone] || "badge-gray"}`;
  }

  nextTimelinePage(): void {
    this.timelinePage.update((page) =>
      Math.min(page + 1, this.totalTimelinePages() - 1),
    );
  }

  previousTimelinePage(): void {
    this.timelinePage.update((page) => Math.max(page - 1, 0));
  }

  timelineRangeLabel(): string {
    const total = this.timeline().length;
    if (total === 0) return "0 de 0";

    const start = this.timelinePage() * this.timelinePageSize + 1;
    const end = Math.min(start + this.timelinePageSize - 1, total);
    return `${start}-${end} de ${total}`;
  }

  private ensureTimelinePageInRange(): void {
    const lastPage = this.totalTimelinePages() - 1;
    if (this.timelinePage() > lastPage) {
      this.timelinePage.set(lastPage);
    }
  }

  
  openNotesModal(appointmentId: number, currentNotes: string = "") {
    this.editingAppointmentId.set(appointmentId);
    this.editingNotes.set(currentNotes);
    this.showNotesModal.set(true);
  }

  closeNotesModal() {
    this.showNotesModal.set(false);
    this.editingAppointmentId.set(null);
    this.editingNotes.set("");
  }

  saveNotes() {
    const appointmentId = this.editingAppointmentId();
    if (!appointmentId) return;

    this.appointmentsService
      .updateAppointment(appointmentId, { notes: this.editingNotes() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedAppt) => {
          
          const appointments = this.appointmentsData();
          const index = appointments.findIndex((a) => a.id === appointmentId);
          if (index !== -1) {
            appointments[index] = updatedAppt;
            this.appointmentsData.set([...appointments]);
          }
          this.closeNotesModal();
        },
        error: (err) => {
          console.error("Error saving notes:", err);
          this.loadingError.set("Error guardando notas");
        },
      });
  }

  trackByIdx(index: number): number {
    return index;
  }
}
