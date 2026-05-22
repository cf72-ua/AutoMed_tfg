import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AdminCatalogItem, AdminService } from "@core/services/admin.service";
import { LoadingSpinnerComponent } from "@shared/components/loading-spinner/loading-spinner.component";

@Component({
  selector: "app-admin-catalog-page",
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingSpinnerComponent],
  templateUrl: "./admin-catalog.page.html",
  styleUrls: ["./admin-table.scss"],
})
export class AdminCatalogPage implements OnInit {
  private adminService = inject(AdminService);

  items: AdminCatalogItem[] = [];
  isLoading = false;
  searchText = "";
  selectedCategory = "";
  currentPage = 1;
  pageSize = 8;

  ngOnInit(): void {
    this.loadCatalog();
  }

  get categories(): string[] {
    return Array.from(new Set(this.items.map((item) => item.category))).sort();
  }

  get filteredItems(): AdminCatalogItem[] {
    const search = this.normalize(this.searchText);
    return this.items.filter((item) => {
      const matchesSearch =
        !search ||
        this.normalize(item.name).includes(search) ||
        this.normalize(item.slug).includes(search) ||
        this.normalize(item.description).includes(search);
      const matchesCategory =
        !this.selectedCategory || item.category === this.selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredItems.length / this.pageSize));
  }

  get paginatedItems(): AdminCatalogItem[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredItems.slice(start, start + this.pageSize);
  }

  loadCatalog(): void {
    this.isLoading = true;
    this.adminService.getCatalog().subscribe({
      next: (items) => {
        this.items = items;
        this.goToPage(this.currentPage);
        this.isLoading = false;
      },
      error: (error) => {
        console.error("Error loading admin catalog:", error);
        this.isLoading = false;
      },
    });
  }

  onFilterChange(): void {
    this.currentPage = 1;
  }

  clearFilters(): void {
    this.searchText = "";
    this.selectedCategory = "";
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

  private normalize(value: string | null | undefined): string {
    return (value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }
}
