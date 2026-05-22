import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { ApiService } from "./api.service";

export interface AdminPatient {
  patientProfileId: number;
  userId: number;
  fullName: string;
  dni: string;
  email?: string;
  phone?: string;
  status: string;
  birthDate?: string;
  sex?: string;
  appointmentCount: number;
  habitCount: number;
  reportCount: number;
  createdAt: string;
}

export interface AdminCatalogItem {
  categoryKey: AdminCatalogCategory;
  category: string;
  id: number;
  name: string;
  slug?: string;
  description?: string;
  detail?: string;
  requiredFields?: string[];
  createdAt?: string;
}

export type AdminCatalogCategory =
  | "medications"
  | "report-types"
  | "locations";

export interface AdminCatalogPayload {
  name: string;
  slug?: string;
  description?: string;
  detail?: string;
  requiredFields?: string[];
}

export interface AdminLogEntry {
  id: number;
  reportId: number;
  reportTitle: string;
  actorUserId: number;
  actorName: string;
  action: string;
  ipAddress?: string;
  reasonNotes?: string;
  createdAt: string;
}

@Injectable({
  providedIn: "root",
})
export class AdminService {
  private endpoint = "/admin";

  constructor(private api: ApiService) {}

  getPatients(): Observable<AdminPatient[]> {
    return this.api.get<AdminPatient[]>(`${this.endpoint}/patients`);
  }

  getCatalog(): Observable<AdminCatalogItem[]> {
    return this.api.get<AdminCatalogItem[]>(`${this.endpoint}/catalog`);
  }

  createCatalogItem(
    category: AdminCatalogCategory,
    payload: AdminCatalogPayload,
  ): Observable<AdminCatalogItem> {
    return this.api.post<AdminCatalogItem>(
      `${this.endpoint}/catalog/${category}`,
      payload,
    );
  }

  updateCatalogItem(
    category: AdminCatalogCategory,
    itemId: number,
    payload: AdminCatalogPayload,
  ): Observable<AdminCatalogItem> {
    return this.api.put<AdminCatalogItem>(
      `${this.endpoint}/catalog/${category}/${itemId}`,
      payload,
    );
  }

  deleteCatalogItem(
    category: AdminCatalogCategory,
    itemId: number,
  ): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(
      `${this.endpoint}/catalog/${category}/${itemId}`,
    );
  }

  getLogs(action = ""): Observable<AdminLogEntry[]> {
    const query = action ? `?action=${encodeURIComponent(action)}` : "";
    return this.api.get<AdminLogEntry[]>(`${this.endpoint}/logs${query}`);
  }
}
