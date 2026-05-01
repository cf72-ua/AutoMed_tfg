import { CommonModule } from '@angular/common';
import { Component, computed, signal, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HabitsService, HabitLog } from '../../../core/services/habits.service';

type HabitTab = 'SLEEP' | 'EXERCISE' | 'NUTRITION' | 'STRESS';
type DayKey = 'Lun' | 'Mar' | 'Mié' | 'Jue' | 'Vie' | 'Sáb' | 'Dom';

type WeeklyEntry = {
  day: DayKey;
  sleepHours: number; // hrs
  exerciseMins: number; // mins
  nutritionScore: number; // 1-3
  stressScore: number; // 1-3
};

@Component({
  selector: 'app-habits-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './habits.page.html',
  styleUrls: ['./habits.page.scss'],
})
export class HabitsPage implements OnInit {
  private habitsService = inject(HabitsService);

  // Tabs
  tab = signal<HabitTab>('SLEEP');

  // Semana (siempre 7 días) - se reconstruye con buildWeekFromHabits()
  week = signal<WeeklyEntry[]>([
    { day: 'Lun', sleepHours: 0, exerciseMins: 0, nutritionScore: 0, stressScore: 0 },
    { day: 'Mar', sleepHours: 0, exerciseMins: 0, nutritionScore: 0, stressScore: 0 },
    { day: 'Mié', sleepHours: 0, exerciseMins: 0, nutritionScore: 0, stressScore: 0 },
    { day: 'Jue', sleepHours: 0, exerciseMins: 0, nutritionScore: 0, stressScore: 0 },
    { day: 'Vie', sleepHours: 0, exerciseMins: 0, nutritionScore: 0, stressScore: 0 },
    { day: 'Sáb', sleepHours: 0, exerciseMins: 0, nutritionScore: 0, stressScore: 0 },
    { day: 'Dom', sleepHours: 0, exerciseMins: 0, nutritionScore: 0, stressScore: 0 },
  ]);

  // State
  allHabits = signal<HabitLog[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);

  selectedIndex = signal<number>(0);

  // Modal
  showModal = signal(false);
  modalType = signal<HabitTab>('SLEEP');
  modalValue = signal<number | string>('');
  modalNotes = signal('');
  modalDate = signal(this.toLocalDateString(new Date()));

  // =========================
  // Semana visible (Lun->Dom)
  // =========================
  weekStart = signal<Date>(this.startOfWeekMonday(new Date()));

  private startOfWeekMonday(d: Date): Date {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = date.getDay(); // 0=Dom..6=Sáb
    const diff = (day + 6) % 7; // Lun = 0
    date.setDate(date.getDate() - diff);
    return date;
  }

  // ✅ CRÍTICO: weekDates depende de weekStart (ya no “últimos 7 días”)
  weekDates = computed(() => {
    const start = this.weekStart();   // lunes de la semana visible
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i);     // lun..dom
        return d;
    });
  });

  weekLabel = computed(() => {
    const dates = this.weekDates();
    const start = dates[0];
    const end = dates[6];

    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const startStr = start.toLocaleDateString('es-ES', options).replace('.', '');
    const endStr = end.toLocaleDateString('es-ES', options).replace('.', '');

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
    // No permitir ir a futuro
    const current = this.startOfWeekMonday(new Date()).getTime();
    const candidate = new Date(this.weekStart());
    candidate.setDate(candidate.getDate() + 7);

    if (candidate.getTime() <= current) {
      this.weekStart.set(candidate);
      this.selectedIndex.set(0);
      this.buildWeekFromHabits(this.allHabits());
    }
  }

  // =========================
  // Selected day info
  // =========================
  selectedDay = computed(() => this.week()[this.selectedIndex()]);

  selectedDateLabel = computed(() => {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dates = this.weekDates();
    const selectedDate = dates[this.selectedIndex()] || dates[0];
    const dayName = days[selectedDate.getDay()];
    const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
    const dateStr = selectedDate.toLocaleDateString('es-ES', options);
    return `${dayName}, ${dateStr}`;
  });

  sleepMax = computed(() => Math.max(...this.week().map(w => Number(w.sleepHours) || 0), 9));
  exerciseMax = computed(() => Math.max(...this.week().map(w => Number(w.exerciseMins) || 0), 60));

  // Barras según tab
  barValue = (e: WeeklyEntry) => {
    switch (this.tab()) {
      case 'SLEEP':
        return e.sleepHours;
      case 'EXERCISE':
        return e.exerciseMins;
      case 'NUTRITION':
        return e.nutritionScore;
      case 'STRESS':
        return e.stressScore;
    }
  };

  barMax = computed(() => {
    switch (this.tab()) {
      case 'SLEEP':
        return this.sleepMax();
      case 'EXERCISE':
        return this.exerciseMax();
      case 'NUTRITION':
        return 3;
      case 'STRESS':
        return 3;
    }
  });

  barLabel = (e: WeeklyEntry) => {
    switch (this.tab()) {
      case 'SLEEP':
        return `${e.sleepHours} hrs`;
      case 'EXERCISE':
        return `${e.exerciseMins} mins`;
      case 'NUTRITION':
        return ['', 'Mala', 'Normal', 'Balanceada'][e.nutritionScore] || '—';
      case 'STRESS':
        return ['', 'Bajo', 'Moderado', 'Alto'][e.stressScore] || '—';
    }
  };

  // Series (siempre 7)
  sleepSeries = computed(() => this.getSeriesForType('SLEEP'));
  exerciseSeries = computed(() => this.getSeriesForType('EXERCISE'));
  nutritionSeries = computed(() => this.getSeriesForType('NUTRITION'));
  stressSeries = computed(() => this.getSeriesForType('STRESS'));

  setTab(t: HabitTab) {
    this.tab.set(t);
  }

  selectDay(i: number) {
    this.selectedIndex.set(i);
  }

  // =========================
  // Charts helpers
  // =========================
  linePath(points: number[]): string {
    if (!points || points.length === 0) return '';

    const dataPoints = points
      .map((v, i) => ({ value: Number(v) || 0, index: i }))
      .filter(p => p.value > 0);

    if (dataPoints.length === 0) return '';

    const w = 280;
    const h = 80;
    const pad = 10;

    const min = Math.min(...dataPoints.map(p => p.value));
    const max = Math.max(...dataPoints.map(p => p.value));
    const range = max - min || 1;

    const toXY = (value: number, dayIndex: number) => {
      const norm = (value - min) / range;
      const x = pad + (dayIndex / (points.length - 1)) * (w - pad * 2);
      const y = pad + (h - pad * 2) * (1 - Math.min(1, norm));
      return { x, y };
    };

    // si solo hay 1 punto, micro-segmento
    if (dataPoints.length === 1) {
      const p = dataPoints[0];
      const { x, y } = toXY(p.value, p.index);
      return `M ${x} ${y} L ${x + 0.01} ${y}`;
    }

    const coords = dataPoints.map(p => toXY(p.value, p.index));
    return coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }

  getChartPoints(points: number[]): { x: number; y: number; value: number }[] {
    if (!points || points.length === 0) return [];

    const w = 280;
    const h = 80;
    const pad = 10;

    const clean = points.map(v => Number(v) || 0);
    const nonZeroValues = clean.filter(v => v > 0);

    const min = nonZeroValues.length > 0 ? Math.min(...nonZeroValues) : 0;
    const max = nonZeroValues.length > 0 ? Math.max(...nonZeroValues) : 1;
    const range = max - min || 1;

    const norm = clean.map(v => (v === 0 ? -1 : (v - min) / range));
    const step = (w - pad * 2) / (clean.length - 1 || 1);

    return norm.map((v, i) => {
      const x = pad + step * i;
      const y = v < 0 ? -100 : pad + (h - pad * 2) * (1 - Math.min(1, v));
      return { x, y, value: clean[i] };
    });
  }

  // ✅ FIX: no es "length>0", sino "algún valor > 0"
  hasSeriesData(series: number[]): boolean {
    return Array.isArray(series) && series.some(v => Number(v) > 0);
  }

  countDataPoints(series: number[]): number {
    return (series || []).filter(v => Number(v) > 0).length;
  }

  seriesSum(series: number[]): number {
    return (series || []).reduce((a, b) => a + (Number(b) || 0), 0);
  }

  getXAxisLabel(index: number): string {
    const dates = this.weekDates();
    if (index >= 0 && index < dates.length) return dates[index].getDate().toString();
    return '';
  }

  // =========================
  // Data mapping
  // =========================
  private toLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getSeriesForType(type: HabitTab): number[] {
    const weekDates = this.weekDates();
    const allHabits = this.allHabits();
    const habits = allHabits.filter(h => h.habitType === type);

    return weekDates.map(date => {
      const dateStr = this.toLocalDateString(date);
      const habitForDay = habits.find(h => h.loggedDate === dateStr);
      return habitForDay ? Number(habitForDay.value) : 0;
    });
  }

  getHabitForSelectedDay(type: HabitTab): number | null {
    const dates = this.weekDates();
    const selectedDate = dates[this.selectedIndex()];
    if (!selectedDate) return null;

    const dateStr = this.toLocalDateString(selectedDate);
    const habit = this.allHabits().find(h => h.habitType === type && h.loggedDate === dateStr);
    return habit ? Number(habit.value) : null;
  }

  ngOnInit() {
    this.goToCurrentWeek();
    this.loadHabits();
  }

  private loadHabits() {
    const patientId = this.getPatientIdFromToken();
    if (!patientId) {
      this.error.set('No estás autenticado. Por favor, inicia sesión nuevamente.');
      return;
    }

    this.isLoading.set(true);

    this.habitsService.getHabits(patientId).subscribe({
      next: (habits) => {
        this.allHabits.set(habits);
        this.buildWeekFromHabits(habits);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading habits:', err);
        this.error.set('Error al cargar los hábitos');
        this.isLoading.set(false);
      },
    });
  }

  private buildWeekFromHabits(habits: HabitLog[]) {
    const dates = this.weekDates();
    const dayLabels: DayKey[] = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    const weekData: WeeklyEntry[] = dates.map((date) => {
      const dateStr = this.toLocalDateString(date);
      const dayHabits = habits.filter(h => h.loggedDate === dateStr);

      const sleep = Number(dayHabits.find(h => h.habitType === 'SLEEP')?.value ?? 0);
      const exercise = Number(dayHabits.find(h => h.habitType === 'EXERCISE')?.value ?? 0);
      const nutrition = Number(dayHabits.find(h => h.habitType === 'NUTRITION')?.value ?? 0);
      const stress = Number(dayHabits.find(h => h.habitType === 'STRESS')?.value ?? 0);

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
    const token = localStorage.getItem('auth_token');
    if (!token) return null;

    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1]));
      const patientId = payload.patientId || payload.patient_id;
      return patientId ? Number(patientId) : null;
    } catch (error) {
      console.error('Error parsing token:', error);
      return null;
    }
  }

  // =========================
  // Modal actions
  // =========================
  openAddModal(type: HabitTab) {
    this.modalType.set(type);
    this.modalValue.set('');
    this.modalNotes.set('');
    this.modalDate.set(this.toLocalDateString(new Date()));
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  saveHabit() {
    const patientId = this.getPatientIdFromToken();
    if (!patientId) {
      alert('Error: No estás autenticado. Por favor, inicia sesión nuevamente.');
      return;
    }

    const value = Number(this.modalValue());
    if (isNaN(value) || value < 0) {
      alert('Por favor, ingresa un valor válido');
      return;
    }

    const habit = {
      patientId,
      habitType: this.modalType(),
      value,
      notes: this.modalNotes(),
      loggedDate: this.modalDate(),
    };

    this.habitsService.createHabit(habit).subscribe({
      next: () => {
        this.closeModal();
        this.loadHabits();
      },
      error: (err) => {
        console.error('Error saving habit:', err);
        alert('Error al guardar el hábito: ' + (err.error?.error || err.message));
      },
    });
  }

  // acciones UI
  addRegistro() { this.openAddModal('SLEEP'); }
  addSueno() { this.openAddModal('SLEEP'); }
  addEjercicio() { this.openAddModal('EXERCISE'); }
  addAlimentacion() { this.openAddModal('NUTRITION'); }
  addEstres() { this.openAddModal('STRESS'); }

  verHistorial() { alert('Mock: ver historial completo'); }
  generarRecomendacion() { alert('Mock: generar recomendación IA'); }
}