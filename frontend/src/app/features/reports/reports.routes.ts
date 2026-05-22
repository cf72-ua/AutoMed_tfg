/**
 * Routes para el módulo de Reportes
 */

import { Routes } from "@angular/router";
import { ReportsListComponent } from "./reports-list.component";
import { ReportEditorComponent } from "./report-editor.component";
import { ReportSignatureComponent } from "./report-signature.component";
import { ReportAuditComponent } from "./report-audit.component";
import { SignatureManagerComponent } from "./signature-manager.component";

export const reportsRoutes: Routes = [
  {
    path: "",
    component: ReportsListComponent,
    data: { title: "Mis Informes Médicos" },
  },
  {
    path: "new",
    component: ReportEditorComponent,
    data: { title: "Crear Nuevo Informe" },
  },
  {
    path: ":id",
    component: ReportEditorComponent,
    data: { title: "Ver/Editar Informe" },
  },
  {
    path: ":id/sign",
    component: ReportSignatureComponent,
    data: { title: "Firmar Informe" },
  },
  {
    path: ":id/audit",
    component: ReportAuditComponent,
    data: { title: "Auditoría de Accesos" },
  },
  {
    path: "signatures/manage",
    component: SignatureManagerComponent,
    data: { title: "Gestor de Firmas Digitales" },
  },
];
