/**
 * Componente: Editor de Reportes (crear/editar borradores)
 */

import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import {
  ReportsService,
  Report,
  ReportType,
  PatientInfo,
} from "../../core/services/reports.service";
import { LoadingSpinnerComponent } from "../../shared/components/loading-spinner/loading-spinner.component";

@Component({
  selector: "app-report-editor",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    LoadingSpinnerComponent,
  ],
  templateUrl: "./report-editor.component.html",
  styleUrls: ["./report-editor.component.scss"],
})
export class ReportEditorComponent implements OnInit {
  reportForm: FormGroup;
  reportTypes: ReportType[] = [];
  patients: PatientInfo[] = [];
  report: Report | null = null;
  selectedReportType: ReportType | null = null;

  isLoading = false;
  isSaving = false;
  isEditing = false;
  isPatientsLoading = false;
  patientsError: string | null = null;

  private reportId: number | null = null;
  private patientId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private reportsService: ReportsService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.reportForm = this.fb.group({
      patientId: ["", Validators.required],
      reportTypeId: ["", Validators.required],
      title: ["", [Validators.required, Validators.minLength(5)]],
      body: ["", [Validators.required, Validators.minLength(20)]],
      observations: [""],
    });
  }

  ngOnInit(): void {
    this.loadReportTypes();
    this.loadPatients();
    this.checkEditMode();
    this.extractPatientId();
  }

  private loadPatients(): void {
    this.isPatientsLoading = true;
    this.patientsError = null;

    this.reportsService.getPatients().subscribe({
      next: (patients) => {
        console.log("Pacientes cargados:", patients);
        this.patients = patients;
        this.isPatientsLoading = false;

        if (patients.length === 0) {
          this.patientsError = "No hay pacientes disponibles";
        }
      },
      error: (error) => {
        console.error("Error al cargar pacientes:", error);
        this.isPatientsLoading = false;
        this.patientsError = `Error al cargar pacientes: ${error.status || "desconocido"} - ${error.message}`;
      },
    });
  }

  private extractPatientId(): void {
    
    this.route.queryParamMap.subscribe((params) => {
      const id = params.get("patientId");
      if (id) {
        this.patientId = parseInt(id);
        this.reportForm.patchValue({ patientId: this.patientId });
      }
    });
  }

  loadReportTypes(): void {
    this.reportsService.getReportTypes().subscribe({
      next: (types) => {
        this.reportTypes = types;
        this.updateSelectedReportType(this.reportForm.value.reportTypeId);
      },
      error: (error) => {
        console.error("Error loading report types:", error);
      },
    });

    this.reportForm.get("reportTypeId")?.valueChanges.subscribe((typeId) => {
      this.updateSelectedReportType(typeId);
    });
  }

  checkEditMode(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get("id");
      if (id && id !== "new") {
        this.isEditing = true;
        this.reportId = parseInt(id);
        this.loadReport();
      }
    });
  }

  loadReport(): void {
    if (!this.reportId) return;

    this.isLoading = true;
    this.reportsService.getReportById(this.reportId).subscribe({
      next: (report) => {
        this.report = report;
        this.populateForm(report);
        this.isLoading = false;
      },
      error: (error) => {
        console.error("Error loading report:", error);
        this.isLoading = false;
        this.router.navigate(["/reports"]);
      },
    });
  }

  populateForm(report: Report): void {
    this.reportForm.patchValue({
      reportTypeId: report.reportTypeId,
      title: report.title,
      body: report.body,
      observations: report.metadata?.["observations"] || "",
    });

    const typeId = report.reportTypeId;
    this.updateSelectedReportType(typeId);
  }

  private updateSelectedReportType(typeId: string | number | null): void {
    const numericTypeId = Number(typeId);
    this.selectedReportType =
      this.reportTypes.find((type) => type.id === numericTypeId) || null;
  }

  onSubmit(): void {
    if (!this.reportForm.valid) return;

    this.isSaving = true;
    const selectedPatientId = this.reportForm.value.patientId;

    const formData = this.reportForm.value;

    const request$ =
      this.isEditing && this.reportId
        ? this.reportsService.updateReport(this.reportId, formData)
        : this.reportsService.createReport(selectedPatientId, formData);

    request$.subscribe({
      next: (report) => {
        this.report = report;
        this.isSaving = false;
        this.patientId = selectedPatientId;
        alert("Informe guardado correctamente");
      },
      error: (error) => {
        console.error("Error saving report:", error);
        this.isSaving = false;
        alert("Error al guardar el informe");
      },
    });
  }

  onSign(): void {
    if (!this.reportId) return;

    
    this.router.navigate(["/reports", this.reportId, "sign"]);
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
}
