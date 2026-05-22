import { CommonModule } from "@angular/common";
import {
  Component,
  EventEmitter,
  computed,
  inject,
  Output,
} from "@angular/core";
import { RouterModule } from "@angular/router";
import { AuthService } from "@core/services/auth.service";

type Role = "PACIENTE" | "DOCTOR" | "ADMIN" | null;

type SideItem = {
  label: string;
  path: string;
  exact?: boolean;
};

@Component({
  selector: "app-sidebar",
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: "./sidebar.component.html",
  styleUrls: ["./sidebar.component.scss"],
})
export class SidebarComponent {
  private auth = inject(AuthService);
  @Output() collapseSidebar = new EventEmitter<void>();

  role = computed<Role>(() => {
    const roleSignal = this.auth.getRole();
    return roleSignal();
  });

  patientItems: SideItem[] = [
    { label: "Calendario", path: "/calendar" },
    { label: "Evolución", path: "/evolution" },
    { label: "Registro de Hábitos", path: "/habits" },
    { label: "Reportes", path: "/reports" },
    { label: "Teleconsulta", path: "/teleconsulta" },
  ];

  professionalItems: SideItem[] = [
    { label: "Calendario", path: "/calendar" },
    { label: "Pacientes", path: "/professional/patients" },
    { label: "Reportes", path: "/reports" },
    { label: "Firmas", path: "/signatures/manage" },
    { label: "Teleconsulta", path: "/teleconsulta" },
  ];

  adminItems: SideItem[] = [
    { label: "Pacientes", path: "/admin/patients" },
    { label: "Catálogo", path: "/admin/catalog" },
    { label: "Control de logs", path: "/admin/logs" },
  ];

  items = computed<SideItem[]>(() => {
    const r = this.role();
    if (r === "ADMIN") return this.adminItems;
    if (r === "DOCTOR") return this.professionalItems;
    return this.patientItems;
  });
}
