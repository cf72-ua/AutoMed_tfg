import { CommonModule } from "@angular/common";
import {
  Component,
  computed,
  inject,
  signal,
  ViewChild,
  ElementRef,
  OnInit,
} from "@angular/core";
import { NavigationEnd, Router, RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { filter } from "rxjs";
import { AuthService } from "@core/services/auth.service";
import { NotificationsService } from "@core/services/notifications.service";

type Role = "PACIENTE" | "DOCTOR" | "ADMIN" | null;
type NavItem = { label: string; path: string; exact?: boolean };
type SearchResult = {
  label: string;
  path: string;
  icon?: string;
  category?: string;
};

@Component({
  selector: "app-navbar",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: "./navbar.component.html",
  styleUrls: ["./navbar.component.scss"],
})
export class NavbarComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private notifications = inject(NotificationsService);

  @ViewChild("searchInput") searchInput?: ElementRef<HTMLInputElement>;

  private url = signal<string>(this.router.url);
  menuOpen = false;
  searchOpen = signal(false);
  searchQuery = signal("");
  searchResults = signal<SearchResult[]>([]);
  unreadNotifications = computed(() => this.notifications.unreadCount());

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.url.set(e.urlAfterRedirects);
        if (this.isLoggedIn()) {
          this.notifications.refresh();
        }
      });

    document.addEventListener("keydown", (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        this.searchOpen.set(!this.searchOpen());
        if (this.searchOpen()) {
          setTimeout(() => this.searchInput?.nativeElement.focus(), 0);
        }
      }
    });
  }

  ngOnInit(): void {
    if (this.isLoggedIn()) {
      this.notifications.refresh();
    }
  }

  isLoggedIn = computed(() => {
    const authSignal = this.auth.isLoggedIn();
    return authSignal();
  });

  role = computed<Role>(() => {
    const roleSignal = this.auth.getRole();
    return roleSignal();
  });

  publicLinks: NavItem[] = [
    { label: "Inicio", path: "/", exact: true },
    { label: "Servicios", path: "/servicios" },
    { label: "Contacto", path: "/contacto" },
  ];

  goPatients() {
    this.router.navigate(["/auth/login"], { queryParams: { as: "paciente" } });
  }

  goDoctors() {
    this.router.navigate(["/auth/login"], { queryParams: { as: "doctor" } });
  }

  privateLinks = computed<NavItem[]>(() => {
    const role = this.role();

    if (role === "ADMIN") {
      return [
        { label: "Panel", path: "/admin", exact: true },
        { label: "Usuarios", path: "/admin/users" },
        { label: "Auditoría", path: "/admin/audit" },
      ];
    }

    if (role === "DOCTOR") {
      return [
        { label: "Panel", path: "/dashboard", exact: true },
        { label: "Perfil", path: "/profile/professional" },
        { label: "Teleconsulta", path: "/teleconsulta" },
        { label: "Reportes", path: "/reports" },
      ];
    }

    return [
      { label: "Panel", path: "/dashboard", exact: true },
      { label: "Perfil", path: "/profile/patient" },
      { label: "Calendario", path: "/calendar" },
      { label: "Reportes", path: "/reports" },
      { label: "Teleconsulta", path: "/teleconsulta" },
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
    this.router.navigate(["/auth/login"]);
  }

  toggleSearch() {
    this.searchOpen.update((v) => !v);
    if (!this.searchOpen()) {
      this.searchQuery.set("");
      this.searchResults.set([]);
    } else {
      setTimeout(() => this.searchInput?.nativeElement.focus(), 0);
    }
  }

  closeSearch() {
    this.searchOpen.set(false);
    this.searchQuery.set("");
    this.searchResults.set([]);
  }

  onSearchInput(query: string) {
    this.searchQuery.set(query);

    if (query.trim().length === 0) {
      this.searchResults.set([]);
      return;
    }

    const results = this.filterSearchResults(query.toLowerCase());
    this.searchResults.set(results);
  }

  private filterSearchResults(query: string): SearchResult[] {
    const role = this.role();
    const allResults: SearchResult[] = [];

    if (role === "ADMIN") {
      allResults.push(
        {
          label: "Panel de administración",
          path: "/admin",
          category: "Navegación",
          icon: "dashboard",
        },
        {
          label: "Gestionar usuarios",
          path: "/admin/users",
          category: "Navegación",
          icon: "people",
        },
        {
          label: "Auditoría",
          path: "/admin/audit",
          category: "Navegación",
          icon: "history",
        },
      );
    } else if (role === "DOCTOR") {
      allResults.push(
        {
          label: "Panel",
          path: "/dashboard",
          category: "Navegación",
          icon: "dashboard",
        },
        {
          label: "Perfil profesional",
          path: "/profile/professional",
          category: "Cuenta",
          icon: "person",
        },
        {
          label: "Teleconsulta",
          path: "/teleconsulta",
          category: "Navegación",
          icon: "video",
        },
        {
          label: "Reportes",
          path: "/reports",
          category: "Navegación",
          icon: "file",
        },
      );
    } else if (role === "PACIENTE") {
      allResults.push(
        {
          label: "Panel",
          path: "/dashboard",
          category: "Navegación",
          icon: "dashboard",
        },
        {
          label: "Mi perfil",
          path: "/profile/patient",
          category: "Cuenta",
          icon: "person",
        },
        {
          label: "Calendario",
          path: "/calendar",
          category: "Navegación",
          icon: "calendar",
        },
        {
          label: "Mis medicamentos",
          path: "/medications",
          category: "Salud",
          icon: "pill",
        },
        {
          label: "Mis hábitos",
          path: "/habits",
          category: "Salud",
          icon: "health",
        },
        {
          label: "Reportes",
          path: "/reports",
          category: "Navegación",
          icon: "file",
        },
        {
          label: "Teleconsulta",
          path: "/teleconsulta",
          category: "Navegación",
          icon: "video",
        },
      );
    }

    return allResults.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query),
    );
  }

  navigateToResult(path: string) {
    this.router.navigate([path]);
    this.closeSearch();
  }
}
