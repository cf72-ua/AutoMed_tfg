import { Injectable, computed, inject, signal } from "@angular/core";
import { catchError, forkJoin, of } from "rxjs";
import {
  Appointment,
  AppointmentsService,
} from "@core/services/appointments.service";
import {
  MedicationAlarm,
  MedicationsService,
} from "@core/services/medications.service";
import {
  TeleconsultationService,
  TeleconsultationSummary,
} from "@core/services/teleconsultation.service";
import { AuthService } from "@core/services/auth.service";

type Role = "PACIENTE" | "DOCTOR" | "ADMIN" | null;

export type NotificationType = "appointment" | "medication" | "message";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  dateLabel: string;
  sortAt: number;
  link: string;
  read: boolean;
}

interface TokenPayload {
  userId?: number;
  patientId?: number;
  role?: Role;
  roles?: Role[];
}

@Injectable({
  providedIn: "root",
})
export class NotificationsService {
  private appointmentsService = inject(AppointmentsService);
  private medicationsService = inject(MedicationsService);
  private teleconsultationService = inject(TeleconsultationService);
  private auth = inject(AuthService);

  private itemsSignal = signal<AppNotification[]>([]);
  private loadingSignal = signal(false);
  private errorSignal = signal<string | null>(null);
  private readIds = signal<Set<string>>(this.loadReadIds());

  items = this.itemsSignal.asReadonly();
  loading = this.loadingSignal.asReadonly();
  error = this.errorSignal.asReadonly();
  unreadCount = computed(
    () => this.itemsSignal().filter((item) => !item.read).length,
  );

  refresh(): void {
    const token = this.decodeToken();
    const role = token?.role || token?.roles?.[0] || this.auth.getRole()();
    const userId = token?.userId || null;
    const patientId = token?.patientId || null;

    if (!role || !userId) {
      this.itemsSignal.set([]);
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    const appointments$ =
      role === "DOCTOR"
        ? this.appointmentsService.getAppointmentsByDoctor(userId)
        : patientId
          ? this.appointmentsService.getAppointments(patientId)
          : of<Appointment[]>([]);

    const medications$ =
      role === "PACIENTE" && patientId
        ? this.medicationsService.getMedicationAlarms(patientId)
        : of<MedicationAlarm[]>([]);

    forkJoin({
      appointments: appointments$.pipe(catchError(() => of<Appointment[]>([]))),
      medications: medications$.pipe(
        catchError(() => of<MedicationAlarm[]>([])),
      ),
      conversations: this.teleconsultationService
        .list()
        .pipe(catchError(() => of<TeleconsultationSummary[]>([]))),
    }).subscribe({
      next: ({ appointments, medications, conversations }) => {
        const readIds = this.readIds();
        const items = [
          ...this.buildAppointmentNotifications(appointments, readIds),
          ...this.buildMedicationNotifications(medications, readIds),
          ...this.buildMessageNotifications(conversations, readIds, userId),
        ].sort((a, b) => b.sortAt - a.sortAt);

        this.itemsSignal.set(items);
        this.loadingSignal.set(false);
      },
      error: () => {
        this.errorSignal.set("No se pudieron cargar las notificaciones");
        this.loadingSignal.set(false);
      },
    });
  }

  markAsRead(id: string): void {
    const next = new Set(this.readIds());
    next.add(id);
    this.persistReadIds(next);
    this.readIds.set(next);
    this.itemsSignal.update((items) =>
      items.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
  }

  markAllAsRead(): void {
    const next = new Set(this.readIds());
    this.itemsSignal().forEach((item) => next.add(item.id));
    this.persistReadIds(next);
    this.readIds.set(next);
    this.itemsSignal.update((items) =>
      items.map((item) => ({ ...item, read: true })),
    );
  }

  private buildAppointmentNotifications(
    appointments: Appointment[],
    readIds: Set<string>,
  ): AppNotification[] {
    const now = new Date();
    const limit = new Date(now);
    limit.setDate(limit.getDate() + 14);

    return appointments
      .map((appointment) => {
        const date = this.parseDateTime(appointment.date, appointment.time);
        return { appointment, date };
      })
      .filter(({ date }) => date >= this.startOfToday(now) && date <= limit)
      .map(({ appointment, date }) => {
        const id = `appointment:${appointment.id}:${date.toISOString()}`;
        const place = appointment.place || "Ubicación por confirmar";
        return {
          id,
          type: "appointment" as const,
          title: "Recordatorio de cita",
          body: `${appointment.title} en ${place}`,
          dateLabel: this.formatDate(date),
          sortAt: date.getTime(),
          link: "/calendar",
          read: readIds.has(id),
        };
      });
  }

  private buildMedicationNotifications(
    medications: MedicationAlarm[],
    readIds: Set<string>,
  ): AppNotification[] {
    const todayKey = new Date().toISOString().slice(0, 10);

    return medications.map((medication) => {
      const date = this.parseTodayTime(medication.time);
      const id = `medication:${medication.id}:${todayKey}`;
      return {
        id,
        type: "medication" as const,
        title: "Recordatorio de medicación",
        body: `${medication.medicationName} - ${medication.dose}`,
        dateLabel: medication.time || "Hoy",
        sortAt: date.getTime(),
        link: "/calendar",
        read: readIds.has(id),
      };
    });
  }

  private buildMessageNotifications(
    conversations: TeleconsultationSummary[],
    readIds: Set<string>,
    currentUserId: number,
  ): AppNotification[] {
    return conversations
      .filter((conversation) => !!conversation.lastMessageAt)
      .filter(
        (conversation) =>
          conversation.lastMessageSenderUserId !== currentUserId,
      )
      .map((conversation) => {
        const date = new Date(conversation.lastMessageAt!);
        const id = `message:${conversation.id}:${conversation.lastMessageAt}`;
        return {
          id,
          type: "message" as const,
          title: "Mensaje sin leer",
          body: `${messageSenderName(conversation)}: ${conversation.lastMessage || "Nuevo mensaje"}`,
          dateLabel: this.formatDate(date),
          sortAt: date.getTime(),
          link: "/teleconsulta",
          read: readIds.has(id),
        };
      });
  }

  private decodeToken(): TokenPayload | null {
    const token = this.auth.getToken();
    if (!token) return null;

    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      let payload = parts[1];
      const padding = 4 - (payload.length % 4);
      if (padding !== 4) payload += "=".repeat(padding);
      return JSON.parse(atob(payload)) as TokenPayload;
    } catch {
      return null;
    }
  }

  private parseDateTime(dateValue: string, timeValue?: string): Date {
    const dateMatch = dateValue.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!dateMatch) return new Date(dateValue);

    const [, year, month, day] = dateMatch;
    const timeMatch = (timeValue || "09:00").match(/(\d{1,2}):(\d{2})/);
    const hour = timeMatch ? Number(timeMatch[1]) : 9;
    const minute = timeMatch ? Number(timeMatch[2]) : 0;
    return new Date(Number(year), Number(month) - 1, Number(day), hour, minute);
  }

  private parseTodayTime(timeValue?: string): Date {
    const date = new Date();
    const timeMatch = (timeValue || "09:00").match(/(\d{1,2}):(\d{2})/);
    date.setHours(timeMatch ? Number(timeMatch[1]) : 9);
    date.setMinutes(timeMatch ? Number(timeMatch[2]) : 0);
    date.setSeconds(0, 0);
    return date;
  }

  private startOfToday(source: Date): Date {
    const date = new Date(source);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private formatDate(date: Date): string {
    if (Number.isNaN(date.getTime())) return "Fecha pendiente";
    return date.toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  private loadReadIds(): Set<string> {
    try {
      const raw = localStorage.getItem("automed_read_notifications");
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  }

  private persistReadIds(ids: Set<string>): void {
    localStorage.setItem(
      "automed_read_notifications",
      JSON.stringify(Array.from(ids).slice(-300)),
    );
  }
}

function messageSenderName(conversation: TeleconsultationSummary): string {
  if (conversation.lastMessageSenderUserId === conversation.patientUserId) {
    return conversation.patientName || "Paciente";
  }

  if (conversation.lastMessageSenderUserId === conversation.doctorUserId) {
    return conversation.doctorName || "Doctor";
  }

  return conversation.patientName || conversation.doctorName || "Teleconsulta";
}
