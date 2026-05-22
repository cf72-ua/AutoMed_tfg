import { Routes } from "@angular/router";
import { AppComponent } from "./app.component";

export const routes: Routes = [
  {
    path: "",
    loadComponent: () =>
      import("./features/public/public-home.page").then(
        (m) => m.PublicHomePage,
      ),
    pathMatch: "full",
  },
  {
    path: "auth",
    loadChildren: () =>
      import("./features/auth/auth.routes").then((m) => m.AUTH_ROUTES),
  },
  {
    path: "servicios",
    loadComponent: () =>
      import("./features/public/public-services.page").then(
        (m) => m.PublicServicesPage,
      ),
  },
  {
    path: "contacto",
    loadComponent: () =>
      import("./features/public/public-contact.page").then(
        (m) => m.PublicContactPage,
      ),
  },
  {
    path: "dashboard",
    component: AppComponent,
  },
  {
    path: "calendar",
    loadComponent: () =>
      import("./features/patient/calendar/calendar.page").then(
        (m) => m.CalendarPage,
      ),
  },
  {
    path: "evolution",
    loadComponent: () =>
      import("./features/patient/evolution/evolution.page").then(
        (m) => m.EvolutionPage,
      ),
  },
  {
    path: "habits",
    loadComponent: () =>
      import("./features/patient/habits/habits.page").then((m) => m.HabitsPage),
  },
  {
    path: "reports",
    loadChildren: () =>
      import("./features/reports/reports.routes").then((m) => m.reportsRoutes),
  },
  {
    path: "teleconsulta",
    loadComponent: () =>
      import("./features/teleconsultation/teleconsultation.page").then(
        (m) => m.TeleconsultationPage,
      ),
  },
  {
    path: "professional/patients",
    loadComponent: () =>
      import("./features/professional/patients/professional-patients.page").then(
        (m) => m.ProfessionalPatientsPage,
      ),
  },
  {
    path: "notificaciones",
    loadComponent: () =>
      import("./features/notifications/notifications.page").then(
        (m) => m.NotificationsPage,
      ),
  },
  {
    path: "signatures/manage",
    loadComponent: () =>
      import("./features/reports/signature-manager.component").then(
        (m) => m.SignatureManagerComponent,
      ),
  },
  {
    path: "profile/patient",
    loadComponent: () =>
      import("./features/patient/patient_profiles/patient-profile.page").then(
        (m) => m.PatientProfilePage,
      ),
  },
  {
    path: "profile/professional",
    loadComponent: () =>
      import("./features/professional/professional_profiles/professional-profile.page").then(
        (m) => m.ProfessionalProfilePage,
      ),
  },
  {
    path: "admin/patients",
    loadComponent: () =>
      import("./features/admin/admin-patients.page").then(
        (m) => m.AdminPatientsPage,
      ),
  },
  {
    path: "admin/catalog",
    loadComponent: () =>
      import("./features/admin/admin-catalog.page").then(
        (m) => m.AdminCatalogPage,
      ),
  },
  {
    path: "admin/logs",
    loadComponent: () =>
      import("./features/admin/admin-logs.page").then((m) => m.AdminLogsPage),
  },
];
