/**
 * Componente: Visor de Auditoría de Reportes
 */

import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, RouterModule } from "@angular/router";
import {
  ReportsService,
  ReportAccessAudit,
} from "../../core/services/reports.service";
import { LoadingSpinnerComponent } from "../../shared/components/loading-spinner/loading-spinner.component";

interface AccessStats {
  viewed: number;
  downloaded: number;
  generated: number;
  signed: number;
  lastAccess: string | null;
}

@Component({
  selector: "app-report-audit",
  standalone: true,
  imports: [CommonModule, RouterModule, LoadingSpinnerComponent],
  templateUrl: "./report-audit.component.html",
  styleUrls: ["./report-audit.component.scss"],
})
export class ReportAuditComponent implements OnInit {
  reportId: number | null = null;
  auditLog: ReportAccessAudit[] = [];
  accessStats: AccessStats | null = null;
  isLoading = false;

  constructor(
    private reportsService: ReportsService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get("id");
      if (id) {
        this.reportId = parseInt(id);
        this.loadAuditData();
      }
    });
  }

  loadAuditData(): void {
    if (!this.reportId) return;

    this.isLoading = true;

    Promise.all([
      this.reportsService.getReportAuditLog(this.reportId).toPromise(),
      this.reportsService.getReportAccessStats(this.reportId).toPromise(),
    ])
      .then(([log, stats]) => {
        this.auditLog = log || [];
        this.accessStats = (stats as unknown as AccessStats) || null;
        this.isLoading = false;
      })
      .catch((error) => {
        console.error("Error loading audit data:", error);
        this.isLoading = false;
      });
  }

  getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      VIEWED: "Visualizado",
      DOWNLOADED: "Descargado",
      GENERATED: "Generado",
      SIGNED: "Firmado",
      ARCHIVED: "Archivado",
    };
    return labels[action] || action;
  }

  getActionColor(action: string): string {
    const colors: Record<string, string> = {
      VIEWED: "info",
      DOWNLOADED: "success",
      GENERATED: "warning",
      SIGNED: "danger",
      ARCHIVED: "secondary",
    };
    return colors[action] || "secondary";
  }
}
