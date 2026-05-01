import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '@core/services/auth.service';

type Role = 'PACIENTE' | 'PROFESIONAL' | 'ADMIN' | null;
type NavItem = { label: string; path: string; exact?: boolean };

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  // Estado reactivo simple (signals)
  private url = signal<string>(this.router.url);
  menuOpen = false;

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.url.set(e.urlAfterRedirects));
  }

  // ------- Estado de sesión -------
  isLoggedIn = computed(() => {
    const authSignal = this.auth.isLoggedIn();
    return authSignal();
  });
  
  role = computed<Role>(() => {
    const roleSignal = this.auth.getRole();
    return roleSignal();
  });

  // ------- Menú público (navbar de la imagen) -------
  publicLinks: NavItem[] = [
    { label: 'Inicio', path: '/', exact: true },
    { label: 'Servicios', path: '/servicios' },
    { label: 'Contacto', path: '/contacto' },
  ];

  // Botones (puedes cambiar a páginas informativas si prefieres)
  goPatients() {
    this.router.navigate(['/auth/login'], { queryParams: { as: 'paciente' } });
  }

  goDoctors() {
    this.router.navigate(['/auth/login'], { queryParams: { as: 'doctor' } });
  }

  // ------- Menú privado (según rol) -------
  privateLinks = computed<NavItem[]>(() => {
    const role = this.role();

    if (role === 'ADMIN') {
      return [
        { label: 'Panel', path: '/admin', exact: true },
        { label: 'Usuarios', path: '/admin/users' },
        { label: 'Auditoría', path: '/admin/audit' },
      ];
    }

    if (role === 'PROFESIONAL') {
      return [
        { label: 'Panel', path: '/dashboard', exact: true },
        { label: 'Teleconsulta', path: '/teleconsulta' },
        { label: 'Reportes', path: '/reports' },
      ];
    }

    // PACIENTE (default)
    return [
      { label: 'Panel', path: '/dashboard', exact: true },
      { label: 'Calendario', path: '/calendar' },
      { label: 'Reportes', path: '/reports' },
      { label: 'Teleconsulta', path: '/teleconsulta' },
    ];
  });

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu() {
    this.menuOpen = false;
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}