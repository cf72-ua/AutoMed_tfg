/**
 * Componente: Lista de Reportes de Paciente
 */

import { Component, OnInit, Input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Router } from "@angular/router";
import { FormsModule } from "@angular/forms";
import {
  ReportsService,
  ReportListItem,
  ReportType,
} from "../../core/services/reports.service";
import { AuthService } from "../../core/services/auth.service";
import { LoadingSpinnerComponent } from "../../shared/components/loading-spinner/loading-spinner.component";

type Role = "PACIENTE" | "DOCTOR" | "ADMIN" | null;

@Component({
  selector: "app-reports-list",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, LoadingSpinnerComponent],
  templateUrl: "./reports-list.component.html",
  styleUrls: ["./reports-list.component.scss"],
})
export class ReportsListComponent implements OnInit {
  @Input() patientId: number | null = null;

  reports: ReportListItem[] = [];
  reportTypes: ReportType[] = [];
  isLoading = false;
  selectedStatus = "";
  selectedReportTypeId = "";
  fromDate = "";
  toDate = "";
  selectedPerson = "";
  searchText = "";
  currentPage = 1;
  pageSize = 5;

  constructor(
    private reportsService: ReportsService,
    private router: Router,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadReportTypes();
    this.loadReports();
  }

  currentRole(): Role {
    return this.authService.getRole()();
  }

  get filteredReports(): ReportListItem[] {
    const search = this.normalize(this.searchText);
    const person = this.normalize(this.selectedPerson);
    const role = this.currentRole();

    return this.reports.filter((report) => {
      const matchesSearch =
        !search ||
        this.normalize(report.title).includes(search) ||
        this.normalize(report.reportTypeName).includes(search);

      const personName =
        role === "DOCTOR" ? report.patientName : report.professionalName;
      const matchesPerson = !person || this.normalize(personName) === person;

      return matchesSearch && matchesPerson;
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredReports.length / this.pageSize));
  }

  get paginatedReports(): ReportListItem[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredReports.slice(start, start + this.pageSize);
  }

  get doctorOptions(): string[] {
    return this.uniqueSorted(
      this.reports.map((report) => report.professionalName),
    );
  }

  get patientOptions(): string[] {
    return this.uniqueSorted(this.reports.map((report) => report.patientName));
  }

  loadReportTypes(): void {
    this.reportsService.getReportTypes().subscribe({
      next: (types) => {
        this.reportTypes = types;
      },
      error: (error) => {
        console.error("Error loading report types:", error);
      },
    });
  }

  loadReports(): void {
    this.isLoading = true;
    const filters = this.buildServerFilters();
    const request$ = this.patientId
      ? this.reportsService.listPatientReports(this.patientId, filters)
      : this.reportsService.listReports(filters);

    request$.subscribe({
      next: (reports) => {
        this.reports = reports;
        this.ensureSelectedPersonExists();
        this.goToPage(this.currentPage);
        this.isLoading = false;
      },
      error: (error) => {
        console.error("Error loading reports:", error);
        this.isLoading = false;
      },
    });
  }

  onServerFilterChange(): void {
    this.currentPage = 1;
    this.loadReports();
  }

  onClientFilterChange(): void {
    this.currentPage = 1;
  }

  clearFilters(): void {
    this.selectedStatus = "";
    this.selectedReportTypeId = "";
    this.fromDate = "";
    this.toDate = "";
    this.selectedPerson = "";
    this.searchText = "";
    this.currentPage = 1;
    this.loadReports();
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage += 1;
    }
  }

  goToPage(page: number): void {
    this.currentPage = Math.min(Math.max(page, 1), this.totalPages);
  }

  viewReport(reportId: number): void {
    this.router.navigate(["/reports", reportId]);
  }

  downloadPDF(reportId: number): void {
    this.reportsService.downloadReportPDF(reportId).subscribe({
      next: (response: Blob) => {
        const url = window.URL.createObjectURL(response);
        const link = document.createElement("a");
        link.href = url;
        link.download = `report-${reportId}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error("Error downloading PDF:", error);
        alert("Error al descargar el PDF");
      },
    });
  }

  viewAudit(reportId: number): void {
    this.router.navigate(["/reports", reportId, "audit"]);
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      draft: "Borrador",
      signed: "Firmado",
      archived: "Archivado",
    };
    return labels[status] || status;
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      draft: "warning",
      signed: "success",
      archived: "secondary",
    };
    return colors[status] || "secondary";
  }

  private buildServerFilters():
    | {
        status?: string;
        reportTypeId?: number;
        fromDate?: Date;
        toDate?: Date;
      }
    | undefined {
    const filters: {
      status?: string;
      reportTypeId?: number;
      fromDate?: Date;
      toDate?: Date;
    } = {};

    if (this.selectedStatus) filters.status = this.selectedStatus;
    if (this.selectedReportTypeId) {
      filters.reportTypeId = Number(this.selectedReportTypeId);
    }
    if (this.fromDate) filters.fromDate = new Date(`${this.fromDate}T00:00:00`);
    if (this.toDate) filters.toDate = new Date(`${this.toDate}T23:59:59`);

    return Object.keys(filters).length > 0 ? filters : undefined;
  }

  private normalize(value: string | null | undefined): string {
    return (value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  private uniqueSorted(values: Array<string | null | undefined>): string[] {
    return Array.from(new Set(values.filter(Boolean) as string[])).sort(
      (a, b) => a.localeCompare(b),
    );
  }

  private ensureSelectedPersonExists(): void {
    if (!this.selectedPerson) return;

    const options =
      this.currentRole() === "DOCTOR"
        ? this.patientOptions
        : this.doctorOptions;

    if (!options.includes(this.selectedPerson)) {
      this.selectedPerson = "";
    }
  }
}
