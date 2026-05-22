/**
 * Componente: Firma de Reportes y Generación de PDF
 */

import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { ReportsService, Report } from "../../core/services/reports.service";
import {
  SignaturesService,
  ProfessionalSignature,
} from "../../core/services/signatures.service";
import { LoadingSpinnerComponent } from "../../shared/components/loading-spinner/loading-spinner.component";

@Component({
  selector: "app-report-signature",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    LoadingSpinnerComponent,
  ],
  templateUrl: "./report-signature.component.html",
  styleUrls: ["./report-signature.component.scss"],
})
export class ReportSignatureComponent implements OnInit {
  report: Report | null = null;
  signatures: ProfessionalSignature[] = [];
  selectedSignatureId: number | null = null;
  confirmSign = false;
  isSigning = false;
  isLoading = false;
  signResult: { success: boolean; message: string; pdfUrl?: string } | null =
    null;

  private reportId: number | null = null;

  constructor(
    private reportsService: ReportsService,
    private signaturesService: SignaturesService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get("id");
      if (id) {
        this.reportId = parseInt(id);
        this.loadData();
      }
    });
  }

  loadData(): void {
    if (!this.reportId) return;

    this.isLoading = true;
    Promise.all([
      this.reportsService.getReportById(this.reportId!).toPromise(),
      this.signaturesService.listSignatures().toPromise(),
    ])
      .then(([report, signatures]) => {
        this.report = report || null;
        this.signatures = signatures || [];

        
        const activeSignature = this.signatures.find((s) => s.isActive);
        if (activeSignature) {
          this.selectedSignatureId = activeSignature.id;
        }

        this.isLoading = false;
      })
      .catch((error) => {
        console.error("Error loading data:", error);
        this.isLoading = false;
      });
  }

  selectSignature(signatureId: number): void {
    this.selectedSignatureId = signatureId;
  }

  onSign(): void {
    if (!this.reportId || !this.selectedSignatureId) return;

    this.isSigning = true;
    this.reportsService
      .signReport(this.reportId, this.selectedSignatureId)
      .subscribe({
        next: (report) => {
          this.report = report;
          this.signResult = {
            success: true,
            message: "✓ Informe firmado exitosamente. PDF generado.",
            pdfUrl: report.pdfUrl || undefined,
          };
          this.isSigning = false;

          setTimeout(() => {
            this.router.navigate(["/reports", this.reportId]);
          }, 2000);
        },
        error: (error) => {
          console.error("Error signing report:", error);
          this.signResult = {
            success: false,
            message:
              "Error al firmar el informe: " +
              (error.error?.message || error.message),
          };
          this.isSigning = false;
        },
      });
  }
}
