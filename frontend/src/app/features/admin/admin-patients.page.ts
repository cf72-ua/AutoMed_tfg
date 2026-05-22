import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  AdminPatient,
  AdminPatientPayload,
  AdminService,
} from "@core/services/admin.service";
import { LoadingSpinnerComponent } from "@shared/components/loading-spinner/loading-spinner.component";

interface PatientForm {
  dni: string;
  password: string;
  fullName: string;
  email: string;
  phone: string;
  birthDate: string;
  sex: string;
}

@Component({
  selector: "app-admin-patients-page",
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingSpinnerComponent],
  templateUrl: "./admin-patients.page.html",
  styleUrls: ["./admin-table.scss"],
})
export class AdminPatientsPage implements OnInit {
  private adminService = inject(AdminService);

  patients: AdminPatient[] = [];
  isLoading = false;
  searchText = "";
  selectedStatus = "";
  currentPage = 1;
  pageSize = 8;
  isSaving = false;
  errorMessage = "";
  showCreateModal = false;
  form: PatientForm = this.getEmptyForm();

  ngOnInit(): void {
    this.loadPatients();
  }

  get filteredPatients(): AdminPatient[] {
    const search = this.normalize(this.searchText);
    return this.patients.filter((patient) => {
      const matchesSearch =
        !search ||
        this.normalize(patient.fullName).includes(search) ||
        this.normalize(patient.dni).includes(search) ||
        this.normalize(patient.email).includes(search);
      const matchesStatus =
        !this.selectedStatus || patient.status === this.selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredPatients.length / this.pageSize));
  }

  get paginatedPatients(): AdminPatient[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredPatients.slice(start, start + this.pageSize);
  }

  get visiblePages(): Array<number | "..."> {
    return this.buildVisiblePages();
  }

  loadPatients(): void {
    this.isLoading = true;
    this.errorMessage = "";
    this.adminService.getPatients().subscribe({
      next: (patients) => {
        this.patients = patients;
        this.goToPage(this.currentPage);
        this.isLoading = false;
      },
      error: (error) => {
        console.error("Error loading admin patients:", error);
        this.errorMessage = "No se pudieron cargar los pacientes.";
        this.isLoading = false;
      },
    });
  }

  onFilterChange(): void {
    this.currentPage = 1;
  }

  clearFilters(): void {
    this.searchText = "";
    this.selectedStatus = "";
    this.currentPage = 1;
  }

  previousPage(): void {
    if (this.currentPage > 1) this.currentPage -= 1;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage += 1;
  }

  goToPage(page: number): void {
    this.currentPage = Math.min(Math.max(page, 1), this.totalPages);
  }

  openCreateModal(): void {
    this.form = this.getEmptyForm();
    this.errorMessage = "";
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    if (this.isSaving) return;
    this.showCreateModal = false;
    this.form = this.getEmptyForm();
  }

  createPatient(): void {
    const payload = this.buildPatientPayload();
    if (!payload.dni || !payload.password || !payload.fullName) {
      this.errorMessage = "DNI, contraseña y nombre completo son obligatorios.";
      return;
    }

    this.isSaving = true;
    this.errorMessage = "";
    this.adminService.createPatient(payload).subscribe({
      next: (patient) => {
        this.patients = [...this.patients, patient].sort((a, b) =>
          a.fullName.localeCompare(b.fullName),
        );
        this.form = this.getEmptyForm();
        this.showCreateModal = false;
        this.isSaving = false;
        this.goToPage(this.currentPage);
      },
      error: (error) => {
        console.error("Error creating patient:", error);
        this.errorMessage =
          error?.status === 409
            ? "Ya existe un paciente con ese DNI."
            : "No se pudo crear el paciente.";
        this.isSaving = false;
      },
    });
  }

  togglePatientStatus(patient: AdminPatient): void {
    const nextStatus = patient.status === "active" ? "inactive" : "active";
    this.errorMessage = "";
    this.adminService.updatePatientStatus(patient.userId, nextStatus).subscribe({
      next: () => {
        this.patients = this.patients.map((current) =>
          current.userId === patient.userId
            ? { ...current, status: nextStatus }
            : current,
        );
      },
      error: (error) => {
        console.error("Error updating patient status:", error);
        this.errorMessage = "No se pudo actualizar el estado del paciente.";
      },
    });
  }

  deletePatient(patient: AdminPatient): void {
    const confirmed = window.confirm(
      `¿Eliminar definitivamente a "${patient.fullName}"? Esta acción eliminará también sus datos clínicos asociados.`,
    );
    if (!confirmed) return;

    this.errorMessage = "";
    this.adminService.deletePatient(patient.userId).subscribe({
      next: () => {
        this.patients = this.patients.filter(
          (current) => current.userId !== patient.userId,
        );
        this.goToPage(this.currentPage);
      },
      error: (error) => {
        console.error("Error deleting patient:", error);
        this.errorMessage = "No se pudo eliminar el paciente.";
      },
    });
  }

  private buildPatientPayload(): AdminPatientPayload {
    return {
      dni: this.form.dni.trim(),
      password: this.form.password.trim(),
      fullName: this.form.fullName.trim(),
      email: this.form.email.trim(),
      phone: this.form.phone.trim(),
      birthDate: this.form.birthDate,
      sex: this.form.sex,
    };
  }

  private getEmptyForm(): PatientForm {
    return {
      dni: "",
      password: "",
      fullName: "",
      email: "",
      phone: "",
      birthDate: "",
      sex: "",
    };
  }

  private buildVisiblePages(): Array<number | "..."> {
    if (this.totalPages <= 5) {
      return Array.from({ length: this.totalPages }, (_, index) => index + 1);
    }

    const pages = new Set<number>([
      1,
      this.totalPages,
      this.currentPage,
      this.currentPage - 1,
      this.currentPage + 1,
    ]);

    const sortedPages = Array.from(pages)
      .filter((page) => page >= 1 && page <= this.totalPages)
      .sort((a, b) => a - b);

    return sortedPages.flatMap((page, index) => {
      const previous = sortedPages[index - 1];
      return previous && page - previous > 1 ? ["..." as const, page] : [page];
    });
  }

  private normalize(value: string | null | undefined): string {
    return (value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }
}
