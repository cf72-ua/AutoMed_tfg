import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AdminLogEntry, AdminService } from "@core/services/admin.service";
import { LoadingSpinnerComponent } from "@shared/components/loading-spinner/loading-spinner.component";

@Component({
  selector: "app-admin-logs-page",
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingSpinnerComponent],
  templateUrl: "./admin-logs.page.html",
  styleUrls: ["./admin-table.scss"],
})
export class AdminLogsPage implements OnInit {
  private adminService = inject(AdminService);

  logs: AdminLogEntry[] = [];
  isLoading = false;
  searchText = "";
  selectedAction = "";
  currentPage = 1;
  pageSize = 8;
  actions = ["VIEWED", "DOWNLOADED", "GENERATED", "SIGNED", "ARCHIVED"];

  ngOnInit(): void {
    this.loadLogs();
  }

  get filteredLogs(): AdminLogEntry[] {
    const search = this.normalize(this.searchText);
    return this.logs.filter((log) => {
      return (
        !search ||
        this.normalize(log.reportTitle).includes(search) ||
        this.normalize(log.actorName).includes(search) ||
        this.normalize(log.ipAddress).includes(search)
      );
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredLogs.length / this.pageSize));
  }

  get paginatedLogs(): AdminLogEntry[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredLogs.slice(start, start + this.pageSize);
  }

  get visiblePages(): Array<number | "..."> {
    return this.buildVisiblePages();
  }

  loadLogs(): void {
    this.isLoading = true;
    this.adminService.getLogs(this.selectedAction).subscribe({
      next: (logs) => {
        this.logs = logs;
        this.goToPage(this.currentPage);
        this.isLoading = false;
      },
      error: (error) => {
        console.error("Error loading admin logs:", error);
        this.isLoading = false;
      },
    });
  }

  onServerFilterChange(): void {
    this.currentPage = 1;
    this.loadLogs();
  }

  onClientFilterChange(): void {
    this.currentPage = 1;
  }

  clearFilters(): void {
    this.searchText = "";
    this.selectedAction = "";
    this.currentPage = 1;
    this.loadLogs();
  }

  actionLabel(action: string): string {
    const labels: Record<string, string> = {
      VIEWED: "Visualizado",
      DOWNLOADED: "Descargado",
      GENERATED: "Generado",
      SIGNED: "Firmado",
      ARCHIVED: "Archivado",
    };
    return labels[action] || action;
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
