import { Injectable, NgZone, inject } from "@angular/core";
import { Observable, Subject } from "rxjs";
import { io, Socket } from "socket.io-client";
import { environment } from "@environments/environment";
import { ApiService } from "./api.service";

export interface TeleconsultationSummary {
  id: number;
  patientId: number;
  patientUserId: number;
  patientName: string;
  professionalId: number;
  doctorUserId: number;
  doctorName: string;
  purpose: string;
  status: "scheduled" | "active" | "closed" | "cancelled";
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastMessageSenderUserId: number | null;
}

export interface TeleconsultationMessage {
  id: number;
  consultationId: number;
  senderUserId: number;
  senderName: string;
  senderRole: "PACIENTE" | "DOCTOR";
  content: string;
  type: "text" | "file" | "system";
  createdAt: string;
}

export interface DoctorOption {
  id: number;
  dni: string;
  fullName: string;
}

@Injectable({
  providedIn: "root",
})
export class TeleconsultationService {
  private api = inject(ApiService);
  private zone = inject(NgZone);
  private socket: Socket | null = null;
  private messageSubject = new Subject<TeleconsultationMessage>();
  private closedSubject = new Subject<TeleconsultationSummary>();

  messages$ = this.messageSubject.asObservable();
  closed$ = this.closedSubject.asObservable();

  list(): Observable<TeleconsultationSummary[]> {
    return this.api.get<TeleconsultationSummary[]>("/teleconsultations");
  }

  listDoctors(): Observable<DoctorOption[]> {
    return this.api.get<DoctorOption[]>("/teleconsultations/doctors");
  }

  getMessages(consultationId: number): Observable<TeleconsultationMessage[]> {
    return this.api.get<TeleconsultationMessage[]>(
      `/teleconsultations/${consultationId}/messages`,
    );
  }

  create(data: {
    patientId: number;
    professionalId?: number;
    doctorUserId?: number;
    purpose: string;
  }): Observable<TeleconsultationSummary> {
    return this.api.post<TeleconsultationSummary>("/teleconsultations", data);
  }

  close(consultationId: number): Observable<TeleconsultationSummary> {
    return this.api.put<TeleconsultationSummary>(
      `/teleconsultations/${consultationId}/close`,
      {},
    );
  }

  downloadClinicalSummaryPdf(consultationId: number): Observable<Blob> {
    return this.api.postBlob(
      `/teleconsultations/${consultationId}/summary/pdf`,
      {},
    );
  }

  connect(): void {
    const token = this.api.getToken();
    if (!token) return;

    if (this.socket?.connected) return;

    this.socket = io(environment.socketUrl, {
      path: "/socket.io",
      transports: ["websocket"],
      auth: { token },
    });

    this.socket.on("message_created", (message: TeleconsultationMessage) => {
      this.zone.run(() => this.messageSubject.next(message));
    });

    this.socket.on(
      "consultation_closed",
      (consultation: TeleconsultationSummary) => {
        this.zone.run(() => this.closedSubject.next(consultation));
      },
    );
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  join(consultationId: number): Promise<void> {
    this.connect();

    return new Promise((resolve, reject) => {
      this.socket?.emit(
        "join_consultation",
        consultationId,
        (response: { ok: boolean; error?: string }) => {
          response?.ok ? resolve() : reject(new Error(response?.error));
        },
      );
    });
  }

  leave(consultationId: number): void {
    this.socket?.emit("leave_consultation", consultationId);
  }

  sendMessage(consultationId: number, content: string): Promise<void> {
    this.connect();

    return new Promise((resolve, reject) => {
      this.socket?.emit(
        "send_message",
        { consultationId, content, type: "text" },
        (response: { ok: boolean; error?: string }) => {
          response?.ok ? resolve() : reject(new Error(response?.error));
        },
      );
    });
  }
}
