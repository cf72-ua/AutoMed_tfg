import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { HabitLog, HabitsService } from '../../../core/services/habits.service';
import { HabitsPage } from './habits.page';

function tokenWithPatient(patientId: number): string {
  return ['header', btoa(JSON.stringify({ patientId })), 'signature'].join('.');
}

function ymd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mondayOf(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - diff);
  return result;
}

describe('HabitsPage', () => {
  let fixture: ComponentFixture<HabitsPage>;
  let component: HabitsPage;
  let habitsService: jasmine.SpyObj<HabitsService>;
  let habits: HabitLog[];

  beforeEach(async () => {
    const monday = mondayOf(new Date());
    habits = [
      {
        id: 1,
        patientId: 21,
        habitType: 'SLEEP',
        value: 7,
        loggedDate: ymd(monday),
        createdAt: new Date(),
      },
      {
        id: 2,
        patientId: 21,
        habitType: 'EXERCISE',
        value: 30,
        loggedDate: ymd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 1)),
        createdAt: new Date(),
      },
    ];

    localStorage.setItem('auth_token', tokenWithPatient(21));
    habitsService = jasmine.createSpyObj<HabitsService>('HabitsService', [
      'getHabits',
      'createHabit',
      'generateRecommendations',
    ]);
    habitsService.getHabits.and.callFake(() => of(habits));
    habitsService.createHabit.and.callFake((habit) => {
      const created = {
        id: 99,
        patientId: habit.patientId,
        habitType: habit.habitType,
        value: habit.value || 0,
        notes: habit.notes,
        loggedDate: habit.loggedDate,
        createdAt: new Date(),
      } as HabitLog;
      habits = [...habits, created];
      return of(created);
    });

    await TestBed.configureTestingModule({
      imports: [HabitsPage],
      providers: [{ provide: HabitsService, useValue: habitsService }],
    }).compileComponents();

    fixture = TestBed.createComponent(HabitsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.removeItem('auth_token');
  });

  it('renderiza la semana actual de lunes a domingo', () => {
    const dates = component.weekDates();
    const labels = component.week().map((day) => day.day);

    expect(dates.length).toBe(7);
    expect(dates[0].getDay()).toBe(1);
    expect(dates[6].getDay()).toBe(0);
    expect(labels).toEqual(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']);
    expect(component.sleepSeries()[0]).toBe(7);
    expect(component.exerciseSeries()[1]).toBe(30);
  });

  it('navega entre semanas y puede volver a la semana actual', () => {
    const currentStart = component.weekStart().getTime();

    component.previousWeek();

    expect(component.weekStart().getTime()).toBeLessThan(currentStart);

    component.nextWeek();

    expect(component.weekStart().getTime()).toBe(currentStart);

    component.previousWeek();
    component.goToCurrentWeek();

    expect(component.weekStart().getTime()).toBe(currentStart);
  });

  it('actualiza las series y gráficas tras guardar un hábito', () => {
    const wednesday = component.weekDates()[2];
    component.openAddModal('SLEEP');
    component.modalDate.set(ymd(wednesday));
    component.modalValue.set(8);

    component.saveHabit();
    fixture.detectChanges();

    expect(habitsService.createHabit).toHaveBeenCalledWith(
      jasmine.objectContaining({
        patientId: 21,
        habitType: 'SLEEP',
        value: 8,
        loggedDate: ymd(wednesday),
      }),
    );
    expect(component.sleepSeries()[2]).toBe(8);
    expect(component.hasSeriesData(component.sleepSeries())).toBeTrue();
    expect(component.linePath(component.sleepSeries())).toContain('M');
  });
});
