import { CommonModule } from "@angular/common";
import { Component, computed, DestroyRef, inject, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router, RouterModule } from "@angular/router";
import { Appointment, AppointmentsService } from "@core/services/appointments.service";
import { AuthService, CurrentUser } from "@core/services/auth.service";
import { PatientInfo, ReportListItem, ReportsService } from "@core/services/reports.service";
import { LoadingSpinnerComponent } from "@shared/components/loading-spinner/loading-spinner.component";
import { forkJoin, of } from "rxjs";
import { catchError, finalize } from "rxjs/operators";

type TokenPayload = {
  userId?: number;
  dni?: string;
  role?: string;
};

@Component({
  selector: "app-professional-profile-page",
  standalone: true,
  imports: [CommonModule, RouterModule, LoadingSpinnerComponent],
  templateUrl: "./professional-profile.page.html",
  styleUrls: ["./professional-profile.page.scss"],
})
export class ProfessionalProfilePage implements OnInit {
  private authService = inject(AuthService);
  private appointmentsService = inject(AppointmentsService);
  private reportsService = inject(ReportsService);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);

  user = signal<CurrentUser | null>(null);
  tokenPayload = signal<TokenPayload | null>(null);
  patients = signal<PatientInfo[]>([]);
  appointments = signal<Appointment[]>([]);
  reports = signal<ReportListItem[]>([]);
  isLoading = signal(false);
  loadingError = signal<string | null>(null);

  displayName = computed(() => {
    const user = this.user();
    return user?.fullName || user?.full_name || "Perfil profesional";
  });

  initials = computed(() =>
    this.displayName()
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "D",
  );

  signedReports = computed(
    () => this.reports().filter((report) => report.status === "signed").length,
  );

  draftReports = computed(
    () => this.reports().filter((report) => report.status === "draft").length,
  );

  nextAppointments = computed(() =>
    this.appointments()
      .filter((appointment) => this.toTime(appointment.date) >= this.startOfToday())
      .sort((a, b) => this.toTime(a.date) - this.toTime(b.date))
      .slice(0, 4),
  );

  recentPatients = computed(() => this.patients().slice(0, 5));

  ngOnInit(): void {
    this.tokenPayload.set(this.decodeToken());
    this.authService
      .getCurrentUser()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => this.user.set(user));

    this.loadProfileData();
  }

  loadProfileData(): void {
    const doctorId = this.tokenPayload()?.userId;
    if (!doctorId) {
      this.loadingError.set("No se pudo identificar el perfil profesional.");
      return;
    }

    this.isLoading.set(true);
    this.loadingError.set(null);

    forkJoin({
      patients: this.reportsService.getPatients().pipe(catchError(() => of([]))),
      appointments: this.appointmentsService.getAppointmentsByDoctor(doctorId).pipe(catchError(() => of([]))),
      reports: this.reportsService.listReports().pipe(catchError(() => of([]))),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: ({ patients, appointments, reports }) => {
          this.patients.set(patients);
          this.appointments.set(appointments);
          this.reports.set(reports);
        },
        error: () => this.loadingError.set("No se pudo cargar el perfil."),
      });
  }

  goTo(path: string): void {
    this.router.navigate([path]);
  }

  formatDate(date: string): string {
    const parsed = this.parseCalendarDate(date);
    if (Number.isNaN(parsed.getTime())) return "Sin fecha";
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(parsed);
  }

  trackById(_: number, item: { id: number | string }): number | string {
    return item.id;
  }

  private decodeToken(): TokenPayload | null {
    const token = this.authService.getToken();
    if (!token) return null;

    try {
      const payload = token.split(".")[1];
      return JSON.parse(atob(payload)) as TokenPayload;
    } catch (error) {
      console.error("Error decoding token:", error);
      return null;
    }
  }

  private toTime(date: string): number {
    const parsed = this.parseCalendarDate(date);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  private parseCalendarDate(date: string): Date {
    const match = date?.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return new Date(date);
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  private startOfToday(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime();
  }
}
