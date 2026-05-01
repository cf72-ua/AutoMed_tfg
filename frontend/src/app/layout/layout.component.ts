import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { AuthService } from '@core/services/auth.service';

type Role = 'PACIENTE' | 'PROFESIONAL' | 'ADMIN' | null;

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, NavbarComponent, RouterOutlet, SidebarComponent],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent {
  private auth = inject(AuthService);

  // Exponer isLoggedIn como signal
  isLoggedIn = computed(() => {
    const authSignal = this.auth.isLoggedIn();
    return authSignal();
  });

  // Exponer role como signal
  role = computed<Role>(() => {
    const roleSignal = this.auth.getRole();
    return roleSignal();
  });
}