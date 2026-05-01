import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

type Role = 'PACIENTE' | 'PROFESIONAL' | 'ADMIN' | null;

type SideItem = {
  label: string;
  path: string;
  exact?: boolean;
};

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent {
  private auth = inject(AuthService);

  role = computed<Role>(() => {
    // getRole() retorna un Signal, así que lo llamamos como función
    const roleSignal = this.auth.getRole();
    return roleSignal();
  });

  patientItems: SideItem[] = [
    { label: 'Calendario', path: '/calendar' },
    { label: 'Evolución', path: '/evolution' },
    { label: 'Registro de Hábitos', path: '/habits' },
    { label: 'Reportes', path: '/reports' },
    { label: 'Teleconsulta', path: '/teleconsulta' },
  ];

  professionalItems: SideItem[] = [
    { label: 'Calendario', path: '/calendar' },
    { label: 'Pacientes', path: '/professional/patients' },
    { label: 'Reportes', path: '/reports' },
    { label: 'Teleconsulta', path: '/teleconsulta' },
  ];

  items = computed<SideItem[]>(() => {
    const r = this.role();
    if (r === 'PROFESIONAL') return this.professionalItems;
    return this.patientItems; // default paciente
  });
}