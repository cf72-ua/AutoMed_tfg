import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  AdminCatalogCategory,
  AdminCatalogItem,
  AdminCatalogPayload,
  AdminService,
} from "@core/services/admin.service";
import { LoadingSpinnerComponent } from "@shared/components/loading-spinner/loading-spinner.component";

interface CatalogOption {
  key: AdminCatalogCategory;
  label: string;
}

interface CatalogForm {
  category: AdminCatalogCategory;
  name: string;
  slug: string;
  description: string;
  detail: string;
  requiredFieldsText: string;
}

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
  isSaving = false;
  errorMessage = "";
  editingItem: AdminCatalogItem | null = null;
  catalogOptions: CatalogOption[] = [
    { key: "medications", label: "Medicamento" },
    { key: "report-types", label: "Tipo de informe" },
    { key: "locations", label: "Ubicación" },
  ];
  form: CatalogForm = this.getEmptyForm();

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

  get visiblePages(): Array<number | "..."> {
    return this.buildVisiblePages();
  }

  loadCatalog(): void {
    this.isLoading = true;
    this.errorMessage = "";
    this.adminService.getCatalog().subscribe({
      next: (items) => {
        this.items = items;
        this.goToPage(this.currentPage);
        this.isLoading = false;
      },
      error: (error) => {
        console.error("Error loading admin catalog:", error);
        this.errorMessage = "No se pudo cargar el catálogo.";
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

  startCreate(category?: AdminCatalogCategory): void {
    this.editingItem = null;
    this.errorMessage = "";
    this.form = this.getEmptyForm(category || this.form.category);
  }

  startEdit(item: AdminCatalogItem): void {
    this.editingItem = item;
    this.errorMessage = "";
    this.form = {
      category: item.categoryKey,
      name: item.name,
      slug: item.slug || "",
      description: item.description || "",
      detail: item.detail || "",
      requiredFieldsText: (item.requiredFields || []).join(", "),
    };
  }

  cancelEdit(): void {
    this.startCreate();
  }

  saveCatalogItem(): void {
    const payload = this.buildPayload();
    if (!payload.name) {
      this.errorMessage = "El nombre es obligatorio.";
      return;
    }

    if (this.form.category === "report-types" && !payload.detail) {
      this.errorMessage = "La plantilla es obligatoria para tipos de informe.";
      return;
    }

    this.isSaving = true;
    this.errorMessage = "";
    const request$ = this.editingItem
      ? this.adminService.updateCatalogItem(
          this.editingItem.categoryKey,
          this.editingItem.id,
          payload,
        )
      : this.adminService.createCatalogItem(this.form.category, payload);

    request$.subscribe({
      next: (savedItem) => {
        if (this.editingItem) {
          this.items = this.items.map((item) =>
            item.categoryKey === savedItem.categoryKey &&
            item.id === savedItem.id
              ? savedItem
              : item,
          );
        } else {
          this.items = [...this.items, savedItem].sort((a, b) =>
            `${a.category}${a.name}`.localeCompare(`${b.category}${b.name}`),
          );
        }
        this.isSaving = false;
        this.startCreate(savedItem.categoryKey);
        this.goToPage(this.currentPage);
      },
      error: (error) => {
        console.error("Error saving catalog item:", error);
        this.errorMessage =
          error?.status === 409
            ? "Ya existe un elemento con ese nombre o slug."
            : "No se pudo guardar el elemento.";
        this.isSaving = false;
      },
    });
  }

  deleteCatalogItem(item: AdminCatalogItem): void {
    const confirmed = window.confirm(
      `¿Eliminar "${item.name}" del catálogo de ${item.category.toLowerCase()}?`,
    );
    if (!confirmed) return;

    this.errorMessage = "";
    this.adminService.deleteCatalogItem(item.categoryKey, item.id).subscribe({
      next: () => {
        this.items = this.items.filter(
          (current) =>
            current.categoryKey !== item.categoryKey || current.id !== item.id,
        );
        if (
          this.editingItem?.categoryKey === item.categoryKey &&
          this.editingItem.id === item.id
        ) {
          this.startCreate(item.categoryKey);
        }
        this.goToPage(this.currentPage);
      },
      error: (error) => {
        console.error("Error deleting catalog item:", error);
        this.errorMessage =
          error?.status === 409
            ? "No se puede eliminar porque está en uso."
            : "No se pudo eliminar el elemento.";
      },
    });
  }

  getCategoryLabel(category: AdminCatalogCategory): string {
    return (
      this.catalogOptions.find((option) => option.key === category)?.label ||
      category
    );
  }

  private buildPayload(): AdminCatalogPayload {
    return {
      name: this.form.name.trim(),
      slug: this.slugify(this.form.name),
      description: this.form.description.trim(),
      detail: this.form.detail.trim(),
      requiredFields: this.form.requiredFieldsText
        .split(",")
        .map((field) => field.trim())
        .filter(Boolean),
    };
  }

  private getEmptyForm(
    category: AdminCatalogCategory = "medications",
  ): CatalogForm {
    return {
      category,
      name: "",
      slug: "",
      description: "",
      detail: category === "report-types" ? "consultation-report.hbs" : "",
      requiredFieldsText:
        category === "report-types" ? "title, body" : "",
    };
  }

  private normalize(value: string | null | undefined): string {
    return (value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  private slugify(value: string): string {
    return this.normalize(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
}
