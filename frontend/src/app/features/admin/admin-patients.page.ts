import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AdminPatient, AdminService } from "@core/services/admin.service";
import { LoadingSpinnerComponent } from "@shared/components/loading-spinner/loading-spinner.component";

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
    this.adminService.getPatients().subscribe({
      next: (patients) => {
        this.patients = patients;
        this.goToPage(this.currentPage);
        this.isLoading = false;
      },
      error: (error) => {
        console.error("Error loading admin patients:", error);
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
