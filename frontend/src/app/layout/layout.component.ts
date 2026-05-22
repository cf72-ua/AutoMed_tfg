import { Component, inject, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterOutlet } from "@angular/router";
import { NavbarComponent } from "./navbar/navbar.component";
import { SidebarComponent } from "./sidebar/sidebar.component";
import { AuthService } from "@core/services/auth.service";

type Role = "PACIENTE" | "DOCTOR" | "ADMIN" | null;

@Component({
  selector: "app-layout",
  standalone: true,
  imports: [CommonModule, NavbarComponent, RouterOutlet, SidebarComponent],
  templateUrl: "./layout.component.html",
  styleUrls: ["./layout.component.scss"],
})
export class LayoutComponent {
  private auth = inject(AuthService);
  sidebarCollapsed = false;

  isLoggedIn = computed(() => {
    const authSignal = this.auth.isLoggedIn();
    return authSignal();
  });

  role = computed<Role>(() => {
    const roleSignal = this.auth.getRole();
    return roleSignal();
  });

  hasSidebar = computed(() => {
    const role = this.role();
    return (
      this.isLoggedIn() &&
      (role === "PACIENTE" || role === "DOCTOR" || role === "ADMIN")
    );
  });

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}
