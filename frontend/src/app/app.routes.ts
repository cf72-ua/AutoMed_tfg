import { Routes } from '@angular/router';
import { AppComponent } from './app.component';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/public/public-home.page').then(m => m.PublicHomePage),
    pathMatch: 'full',
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  {
    path: 'dashboard',
    component: AppComponent
  },
  {
    path: 'calendar',
    loadComponent: () => import('./features/patient/calendar/calendar.page').then(m => m.CalendarPage)
  },
  {
    path: 'evolution',
    loadComponent: () => import('./features/patient/evolution/evolution.page').then(m => m.EvolutionPage)
  },
  {
    path: 'habits',
    loadComponent: () => import('./features/patient/habits/habits.page').then(m => m.HabitsPage)
  }
];
