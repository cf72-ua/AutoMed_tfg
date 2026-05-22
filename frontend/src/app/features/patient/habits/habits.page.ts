import { CommonModule } from "@angular/common";
import {
  Component,
  computed,
  signal,
  OnInit,
  inject,
  DestroyRef,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  HabitsService,
  HabitLog,
  RecommendationResult,
} from "../../../core/services/habits.service";

type HabitTab = "SLEEP" | "EXERCISE" | "NUTRITION" | "STRESS";
type DayKey = "Lun" | "Mar" | "Mié" | "Jue" | "Vie" | "Sáb" | "Dom";

type WeeklyEntry = {
  day: DayKey;
  sleepHours: number; 
  exerciseMins: number; 
  nutritionScore: number; 
  stressScore: number; 
};

@Component({
  selector: "app-habits-page",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./habits.page.html",
  styleUrls: ["./habits.page.scss"],
})
export class HabitsPage implements OnInit {
  private habitsService = inject(HabitsService);
  private destroyRef = inject(DestroyRef);

  
  tab = signal<HabitTab>("SLEEP");

  
  week = signal<WeeklyEntry[]>([
    {
      day: "Lun",
      sleepHours: 0,
      exerciseMins: 0,
      nutritionScore: 0,
      stressScore: 0,
    },
    {
      day: "Mar",
      sleepHours: 0,
      exerciseMins: 0,
      nutritionScore: 0,
      stressScore: 0,
    },
    {
      day: "Mié",
      sleepHours: 0,
      exerciseMins: 0,
      nutritionScore: 0,
      stressScore: 0,
    },
    {
      day: "Jue",
      sleepHours: 0,
      exerciseMins: 0,
      nutritionScore: 0,
      stressScore: 0,
    },
    {
      day: "Vie",
      sleepHours: 0,
      exerciseMins: 0,
      nutritionScore: 0,
      stressScore: 0,
    },
    {
      day: "Sáb",
      sleepHours: 0,
      exerciseMins: 0,
      nutritionScore: 0,
      stressScore: 0,
    },
    {
      day: "Dom",
      sleepHours: 0,
      exerciseMins: 0,
      nutritionScore: 0,
      stressScore: 0,
    },
  ]);

  
  allHabits = signal<HabitLog[]>([]);
  isLoading = signal(false);
  isSavingHabit = signal(false);
  error = signal<string | null>(null);

  selectedIndex = signal<number>(0);

  
  showModal = signal(false);
  modalType = signal<HabitTab>("SLEEP");
  modalValue = signal<number | string>("");
  modalNotes = signal("");
  modalDate = signal(this.toLocalDateString(new Date()));

  
  showRecommendationsModal = signal(false);
  recommendations = signal<RecommendationResult | null>(null);
  isGeneratingRecommendations = signal(false);
  recommendationsError = signal<string | null>(null);

  
  
  
  weekStart = signal<Date>(this.startOfWeekMonday(new Date()));

  private startOfWeekMonday(d: Date): Date {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = date.getDay(); 
    const diff = (day + 6) % 7; 
    date.setDate(date.getDate() - diff);
    return date;
  }

  
  weekDates = computed(() => {
    const start = this.weekStart(); 
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i); 
      return d;
    });
  });

  weekLabel = computed(() => {
    const dates = this.weekDates();
    const start = dates[0];
    const end = dates[6];

    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
    };
    const startStr = start
      .toLocaleDateString("es-ES", options)
      .replace(".", "");
    const endStr = end.toLocaleDateString("es-ES", options).replace(".", "");

    return `${startStr} - ${endStr}`;
  });

  goToCurrentWeek() {
    this.weekStart.set(this.startOfWeekMonday(new Date()));
    this.selectedIndex.set(0);
    this.buildWeekFromHabits(this.allHabits());
  }

  previousWeek() {
    const d = new Date(this.weekStart());
    d.setDate(d.getDate() - 7);
    this.weekStart.set(d);
    this.selectedIndex.set(0);
    this.buildWeekFromHabits(this.allHabits());
  }

  nextWeek() {
    
    const current = this.startOfWeekMonday(new Date()).getTime();
    const candidate = new Date(this.weekStart());
    candidate.setDate(candidate.getDate() + 7);

    if (candidate.getTime() <= current) {
      this.weekStart.set(candidate);
      this.selectedIndex.set(0);
      this.buildWeekFromHabits(this.allHabits());
    }
  }

  
  
  
  selectedDay = computed(() => this.week()[this.selectedIndex()]);

  selectedDateLabel = computed(() => {
    const days = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ];
    const dates = this.weekDates();
    const selectedDate = dates[this.selectedIndex()] || dates[0];
    const dayName = days[selectedDate.getDay()];
    const options: Intl.DateTimeFormatOptions = {
      month: "long",
      day: "numeric",
    };
    const dateStr = selectedDate.toLocaleDateString("es-ES", options);
    return `${dayName}, ${dateStr}`;
  });

  sleepMax = computed(() =>
    Math.max(...this.week().map((w) => Number(w.sleepHours) || 0), 9),
  );
  exerciseMax = computed(() =>
    Math.max(...this.week().map((w) => Number(w.exerciseMins) || 0), 60),
  );

  
  barValue = (e: WeeklyEntry) => {
    switch (this.tab()) {
      case "SLEEP":
        return e.sleepHours;
      case "EXERCISE":
        return e.exerciseMins;
      case "NUTRITION":
        return e.nutritionScore;
      case "STRESS":
        return e.stressScore;
    }
  };

  barMax = computed(() => {
    switch (this.tab()) {
      case "SLEEP":
        return this.sleepMax();
      case "EXERCISE":
        return this.exerciseMax();
      case "NUTRITION":
        return 3;
      case "STRESS":
        return 3;
    }
  });

  barLabel = (e: WeeklyEntry) => {
    switch (this.tab()) {
      case "SLEEP":
        return `${e.sleepHours} hrs`;
      case "EXERCISE":
        return `${e.exerciseMins} mins`;
      case "NUTRITION":
        return ["", "Mala", "Normal", "Balanceada"][e.nutritionScore] || "—";
      case "STRESS":
        return ["", "Bajo", "Moderado", "Alto"][e.stressScore] || "—";
    }
  };

  
  sleepSeries = computed(() => this.getSeriesForType("SLEEP"));
  exerciseSeries = computed(() => this.getSeriesForType("EXERCISE"));
  nutritionSeries = computed(() => this.getSeriesForType("NUTRITION"));
  stressSeries = computed(() => this.getSeriesForType("STRESS"));

  setTab(t: HabitTab) {
    this.tab.set(t);
  }

  selectDay(i: number) {
    this.selectedIndex.set(i);
  }

  
  
  
  private readonly chartWidth = 320;
  private readonly chartHeight = 140;
  private readonly chartPadding = {
    top: 14,
    right: 12,
    bottom: 14,
    left: 42,
  };

  private getChartScale(points: number[], fixedScale = false) {
    const clean = (points || []).map((v) => Number(v) || 0);
    if (fixedScale) {
      return { clean, min: 1, max: 3, range: 2 };
    }

    const values = clean.filter((v) => v > 0);
    const rawMin = values.length ? Math.min(...values) : 0;
    const rawMax = values.length ? Math.max(...values) : 1;
    const min = Math.max(0, Math.floor(rawMin));
    const max = Math.max(min + 1, Math.ceil(rawMax));
    const range = max - min || 1;

    return { clean, min, max, range };
  }

  chartViewBox(): string {
    return `0 0 ${this.chartWidth} ${this.chartHeight}`;
  }

  linePath(points: number[], fixedScale = false): string {
    if (!points || points.length === 0) return "";

    const dataPoints = points
      .map((v, i) => ({ value: Number(v) || 0, index: i }))
      .filter((p) => p.value > 0);

    if (dataPoints.length === 0) return "";

    const { min, range } = this.getChartScale(points, fixedScale);
    const { left, right, top, bottom } = this.chartPadding;
    const plotWidth = this.chartWidth - left - right;
    const plotHeight = this.chartHeight - top - bottom;

    const toXY = (value: number, dayIndex: number) => {
      const norm = (value - min) / range;
      const x = left + (dayIndex / (points.length - 1 || 1)) * plotWidth;
      const y = top + plotHeight * (1 - Math.min(1, Math.max(0, norm)));
      return { x, y };
    };

    
    if (dataPoints.length === 1) {
      const p = dataPoints[0];
      const { x, y } = toXY(p.value, p.index);
      return `M ${x} ${y} L ${x + 0.01} ${y}`;
    }

    const coords = dataPoints.map((p) => toXY(p.value, p.index));
    return coords
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");
  }

  getChartPoints(
    points: number[],
    fixedScale = false,
  ): { x: number; y: number; value: number }[] {
    if (!points || points.length === 0) return [];

    const { clean, min, range } = this.getChartScale(points, fixedScale);
    const { left, right, top, bottom } = this.chartPadding;
    const plotWidth = this.chartWidth - left - right;
    const plotHeight = this.chartHeight - top - bottom;

    const norm = clean.map((v) => (v === 0 ? -1 : (v - min) / range));
    const step = plotWidth / (clean.length - 1 || 1);

    return norm.map((v, i) => {
      const x = left + step * i;
      const y =
        v < 0 ? -100 : top + plotHeight * (1 - Math.min(1, Math.max(0, v)));
      return { x, y, value: clean[i] };
    });
  }

  getYAxisTicks(
    points: number[],
    fixedScale = false,
  ): { label: string; y: number }[] {
    const { min, max } = this.getChartScale(points, fixedScale);
    const { top, bottom } = this.chartPadding;
    const plotHeight = this.chartHeight - top - bottom;
    const mid = min + (max - min) / 2;

    return [
      { label: this.formatAxisValue(max), y: top },
      { label: this.formatAxisValue(mid), y: top + plotHeight / 2 },
      { label: this.formatAxisValue(min), y: top + plotHeight },
    ];
  }

  getYAxisGridLineX1(): number {
    return this.chartPadding.left;
  }

  getYAxisGridLineX2(): number {
    return this.chartWidth - this.chartPadding.right;
  }

  getYAxisAxisX(): number {
    return this.chartPadding.left;
  }

  private formatAxisValue(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  
  hasSeriesData(series: number[]): boolean {
    return Array.isArray(series) && series.some((v) => Number(v) > 0);
  }

  countDataPoints(series: number[]): number {
    return (series || []).filter((v) => Number(v) > 0).length;
  }

  seriesSum(series: number[]): number {
    return (series || []).reduce((a, b) => a + (Number(b) || 0), 0);
  }

  getXAxisLabel(index: number): string {
    const dates = this.weekDates();
    if (index >= 0 && index < dates.length)
      return dates[index].getDate().toString();
    return "";
  }

  
  
  
  private toLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private getSeriesForType(type: HabitTab): number[] {
    const weekDates = this.weekDates();
    const allHabits = this.allHabits();
    const habits = allHabits.filter((h) => h.habitType === type);

    return weekDates.map((date) => {
      const dateStr = this.toLocalDateString(date);
      const habitForDay = habits.find(
        (h) => this.normalizeApiDateToYMD(h.loggedDate) === dateStr,
      );
      return habitForDay ? Number(habitForDay.value) : 0;
    });
  }

  getHabitForSelectedDay(type: HabitTab): number | null {
    const dates = this.weekDates();
    const selectedDate = dates[this.selectedIndex()];
    if (!selectedDate) return null;

    const dateStr = this.toLocalDateString(selectedDate);
    const habit = this.allHabits().find(
      (h) =>
        h.habitType === type &&
        this.normalizeApiDateToYMD(h.loggedDate) === dateStr,
    );
    return habit ? Number(habit.value) : null;
  }

  ngOnInit() {
    this.goToCurrentWeek();
    this.loadHabits();
  }

  private loadHabits() {
    const patientId = this.getPatientIdFromToken();
    if (!patientId) {
      this.error.set(
        "No estás autenticado. Por favor, inicia sesión nuevamente.",
      );
      return;
    }

    this.isLoading.set(true);

    this.habitsService.getHabits(patientId).subscribe({
      next: (habits) => {
        console.log(habits);
        this.allHabits.set(habits);
        this.buildWeekFromHabits(habits);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error("Error loading habits:", err);
        this.error.set("Error al cargar los hábitos");
        this.isLoading.set(false);
      },
    });
  }

  private buildWeekFromHabits(habits: HabitLog[]) {
    const dates = this.weekDates();
    const dayLabels: DayKey[] = [
      "Dom",
      "Lun",
      "Mar",
      "Mié",
      "Jue",
      "Vie",
      "Sáb",
    ];

    const weekData: WeeklyEntry[] = dates.map((date) => {
      const dateStr = this.toLocalDateString(date);
      const dayHabits = habits.filter(
        (h) => this.normalizeApiDateToYMD(h.loggedDate) === dateStr,
      );

      const sleep = Number(
        dayHabits.find((h) => h.habitType === "SLEEP")?.value ?? 0,
      );
      const exercise = Number(
        dayHabits.find((h) => h.habitType === "EXERCISE")?.value ?? 0,
      );
      const nutrition = Number(
        dayHabits.find((h) => h.habitType === "NUTRITION")?.value ?? 0,
      );
      const stress = Number(
        dayHabits.find((h) => h.habitType === "STRESS")?.value ?? 0,
      );

      return {
        day: dayLabels[date.getDay()],
        sleepHours: sleep,
        exerciseMins: exercise,
        nutritionScore: nutrition,
        stressScore: stress,
      };
    });

    this.week.set(weekData);
  }

  getPatientIdFromToken(): number | null {
    const token = localStorage.getItem("auth_token");
    if (!token) return null;

    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1]));
      const patientId = payload.patientId || payload.patient_id;
      return patientId ? Number(patientId) : null;
    } catch (error) {
      console.error("Error parsing token:", error);
      return null;
    }
  }

  
  
  
  openAddModal(type: HabitTab) {
    this.modalType.set(type);
    this.modalValue.set("");
    this.modalNotes.set("");
    this.modalDate.set(this.toLocalDateString(new Date()));
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  saveHabit() {
    const patientId = this.getPatientIdFromToken();
    if (!patientId) {
      alert(
        "Error: No estás autenticado. Por favor, inicia sesión nuevamente.",
      );
      return;
    }

    const isNutrition = this.modalType() === "NUTRITION";
    const value = Number(this.modalValue());

    if (!isNutrition && (isNaN(value) || value < 0)) {
      alert("Por favor, ingresa un valor válido");
      return;
    }

    if (isNutrition && !this.modalNotes().trim()) {
      alert("Describe lo que has comido durante el día");
      return;
    }

    const habit = {
      patientId,
      habitType: this.modalType(),
      value: isNutrition ? undefined : value,
      notes: this.modalNotes(),
      loggedDate: this.modalDate(),
    };

    this.isSavingHabit.set(true);
    this.habitsService.createHabit(habit).subscribe({
      next: () => {
        this.isSavingHabit.set(false);
        this.closeModal();
        this.loadHabits();
      },
      error: (err) => {
        this.isSavingHabit.set(false);
        console.error("Error saving habit:", err);
        alert(
          "Error al guardar el hábito: " + (err.error?.error || err.message),
        );
      },
    });
  }

  private normalizeApiDateToYMD(apiDate: string): string {
    if (!apiDate) return "";

    
    if (/^\d{4}-\d{2}-\d{2}$/.test(apiDate)) return apiDate;

    
    const d = new Date(apiDate);

    
    return this.toLocalDateString(d);
  }

  
  addRegistro() {
    this.openAddModal("SLEEP");
  }
  addSueno() {
    this.openAddModal("SLEEP");
  }
  addEjercicio() {
    this.openAddModal("EXERCISE");
  }
  addAlimentacion() {
    this.openAddModal("NUTRITION");
  }
  addEstres() {
    this.openAddModal("STRESS");
  }

  verHistorial() {
    alert("Mock: ver historial completo");
  }

  generarRecomendacion() {
    const patientId = this.getPatientIdFromToken();
    if (!patientId) {
      this.recommendationsError.set(
        "No estás autenticado. Por favor, inicia sesión nuevamente.",
      );
      return;
    }

    this.isGeneratingRecommendations.set(true);
    this.recommendationsError.set(null);

    this.habitsService
      .generateRecommendations(patientId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.recommendations.set(result);
          this.showRecommendationsModal.set(true);
          this.isGeneratingRecommendations.set(false);
        },
        error: (err) => {
          console.error("Error generating recommendations:", err);
          this.recommendationsError.set(
            "Error al generar recomendaciones. Intenta de nuevo.",
          );
          this.isGeneratingRecommendations.set(false);
        },
      });
  }

  closeRecommendationsModal() {
    this.showRecommendationsModal.set(false);
    this.recommendations.set(null);
    this.recommendationsError.set(null);
  }
}
