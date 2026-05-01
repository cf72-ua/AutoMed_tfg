import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';

type Trend = 'MEJORA' | 'ESTABLE' | 'EMPEORA';

type HabitCard = {
  key: 'sleep' | 'exercise' | 'nutrition' | 'stress';
  title: string;
  unit: string;
  averageLabel?: string; // "Promedio: 7.2 h"
  totalLabel?: string;   // "Total: 2.5 h/sem"
  trend?: Trend;
  trendLabel?: string;
  points: number[];      // datos ficticios (4 meses)
};

type TimelineKind = 'HABITOS' | 'CITA' | 'SINTOMAS' | 'PLAN';

type TimelineItem = {
  dateLabel: string; // "Abr 26"
  title: string;
  kind: TimelineKind;
  detail: string;
  badge?: { text: string; tone: 'blue' | 'green' | 'amber' | 'red' | 'gray' };
};

@Component({
  selector: 'app-evolution-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './evolution.page.html',
  styleUrls: ['./evolution.page.scss'],
})
export class EvolutionPage {
  months = ['Ene', 'Feb', 'Mar', 'Abr'];

  cards = signal<HabitCard[]>([
    {
      key: 'sleep',
      title: 'Sueño',
      unit: 'hrs / día',
      averageLabel: 'Promedio: 7.2 h',
      points: [6.8, 6.6, 7.0, 7.4],
      trend: 'MEJORA',
      trendLabel: 'Mejora',
    },
    {
      key: 'exercise',
      title: 'Ejercicio',
      unit: 'hrs / semana',
      totalLabel: 'Total: 2.5 h/sem',
      points: [1.1, 1.0, 2.6, 2.9],
      trend: 'MEJORA',
      trendLabel: 'Mejora',
    },
    {
      key: 'nutrition',
      title: 'Alimentación',
      unit: 'score',
      points: [45, 52, 50, 63],
      trend: 'MEJORA',
      trendLabel: 'Mejora',
    },
    {
      key: 'stress',
      title: 'Estrés',
      unit: 'nivel',
      points: [7, 6, 6, 4],
      trend: 'MEJORA',
      trendLabel: 'Mejora',
    },
  ]);

  timeline = signal<TimelineItem[]>([
    {
      dateLabel: 'Abr 26',
      title: 'Registro de Hábitos',
      kind: 'HABITOS',
      detail: 'Sueño: 7 h · Ejercicio: 30 min',
      badge: { text: 'OK', tone: 'blue' },
    },
    {
      dateLabel: 'Abr 25',
      title: 'Cita Nutrición',
      kind: 'CITA',
      detail: 'Progreso: + Mejoría',
      badge: { text: 'Mejoría', tone: 'green' },
    },
    {
      dateLabel: 'Abr 20',
      title: 'Síntomas',
      kind: 'SINTOMAS',
      detail: 'Fatiga leve (Escala: 3/10)',
      badge: { text: 'Leve', tone: 'amber' },
    },
    {
      dateLabel: 'Abr 15',
      title: 'Consulta Médica',
      kind: 'CITA',
      detail: 'Seguimiento + Recomendaciones',
      badge: { text: 'Seguimiento', tone: 'gray' },
    },
    {
      dateLabel: 'Abr 05',
      title: 'Registro de Hábitos',
      kind: 'HABITOS',
      detail: 'Sueño: 6.5 h · Estrés: Medio',
      badge: { text: 'Medio', tone: 'amber' },
    },
    {
      dateLabel: 'Mar 28',
      title: 'Síntomas',
      kind: 'SINTOMAS',
      detail: 'Dolor de cabeza (Escala: 7/10)',
      badge: { text: 'Alto', tone: 'red' },
    },
    {
      dateLabel: 'Mar 10',
      title: 'Inicio Plan de Ejercicio',
      kind: 'PLAN',
      detail: 'Meta: 3 hrs/semana',
      badge: { text: 'Meta', tone: 'green' },
    },
  ]);

  // helpers para mini-gráfica (SVG)
  pointsToPath(points: number[]) {
    // normaliza a 0..1
    const min = Math.min(...points);
    const max = Math.max(...points);
    const norm = points.map(v => (max === min ? 0.5 : (v - min) / (max - min)));

    const w = 260;
    const h = 90;
    const pad = 10;
    const step = (w - pad * 2) / (points.length - 1);

    const coords = norm.map((v, i) => {
      const x = pad + step * i;
      const y = pad + (h - pad * 2) * (1 - v);
      return { x, y };
    });

    return coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }

  calculateCy(points: number[], index: number): number {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    return 10 + 90 - (90 * ((points[index] - min) / range));
  }

  badgeClass(tone?: string) {
    return tone ? `badge ${tone}` : 'badge gray';
  }

  iconFor(kind: TimelineKind) {
    switch (kind) {
      case 'HABITOS': return '🌙';
      case 'CITA': return '🩺';
      case 'SINTOMAS': return '⚠️';
      case 'PLAN': return '🏃';
      default: return '•';
    }
  }
}