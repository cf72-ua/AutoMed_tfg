import { CommonModule } from "@angular/common";
import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Subscription } from "rxjs";
import { AuthService } from "@core/services/auth.service";
import { AppointmentsService } from "@core/services/appointments.service";
import { PatientInfo, ReportsService } from "@core/services/reports.service";
import {
  DoctorOption,
  TeleconsultationMessage,
  TeleconsultationService,
  TeleconsultationSummary,
} from "@core/services/teleconsultation.service";

type Role = "PACIENTE" | "DOCTOR" | "ADMIN" | null;

interface TokenPayload {
  userId: number;
  patientId?: number;
  role?: Role;
  roles?: Role[];
}

@Component({
  selector: "app-teleconsultation-page",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./teleconsultation.page.html",
  styleUrls: ["./teleconsultation.page.scss"],
})
export class TeleconsultationPage implements OnInit, OnDestroy {
  private teleconsultationService = inject(TeleconsultationService);
  private appointmentsService = inject(AppointmentsService);
  private reportsService = inject(ReportsService);
  private auth = inject(AuthService);
  private messageSub?: Subscription;
  private closedSub?: Subscription;

  conversations = signal<TeleconsultationSummary[]>([]);
  messages = signal<TeleconsultationMessage[]>([]);
  doctors = signal<DoctorOption[]>([]);
  patients = signal<PatientInfo[]>([]);
  selectedConversation = signal<TeleconsultationSummary | null>(null);
  loading = signal(false);
  sending = signal(false);
  closing = signal(false);
  generatingSummary = signal(false);
  creatingMeetAppointment = signal(false);
  error = signal<string | null>(null);
  meetAppointmentUrl = signal<string | null>(null);

  newMessage = "";
  newPurpose = "";
  selectedDoctorId: number | null = null;
  meetPatientId: number | null = null;
  meetTitle = "Teleconsulta médica";
  meetDate = "";
  meetTime = "";
  meetNotes = "";

  role = computed<Role>(() => this.auth.getRole()());
  currentUserId = computed(() => this.decodeToken()?.userId || null);
  currentPatientId = computed(() => this.decodeToken()?.patientId || null);

  ngOnInit(): void {
    this.teleconsultationService.connect();
    this.loadConversations();
    this.loadDoctors();
    this.loadPatients();

    this.messageSub = this.teleconsultationService.messages$.subscribe(
      (message) => {
        const current = this.selectedConversation();
        if (!current || message.consultationId !== current.id) return;

        this.messages.update((messages) => {
          if (messages.some((item) => item.id === message.id)) return messages;
          return [...messages, message];
        });

        this.conversations.update((items) =>
          items.map((item) =>
            item.id === message.consultationId
              ? {
                  ...item,
                  lastMessage: message.content,
                  lastMessageAt: message.createdAt,
                }
              : item,
          ),
        );
      },
    );

    this.closedSub = this.teleconsultationService.closed$.subscribe(
      (conversation) => {
        this.applyClosedConversation(conversation);
      },
    );
  }

  ngOnDestroy(): void {
    const selected = this.selectedConversation();
    if (selected) {
      this.teleconsultationService.leave(selected.id);
    }
    this.messageSub?.unsubscribe();
    this.closedSub?.unsubscribe();
    this.teleconsultationService.disconnect();
  }

  loadConversations(): void {
    this.loading.set(true);
    this.error.set(null);

    this.teleconsultationService.list().subscribe({
      next: (conversations) => {
        this.conversations.set(conversations);
        this.loading.set(false);

        if (!this.selectedConversation() && conversations.length > 0) {
          this.selectConversation(conversations[0]);
        }
      },
      error: () => {
        this.error.set("No se pudieron cargar las teleconsultas");
        this.loading.set(false);
      },
    });
  }

  loadDoctors(): void {
    this.teleconsultationService.listDoctors().subscribe({
      next: (doctors) => this.doctors.set(doctors),
      error: () => this.error.set("No se pudo cargar la lista de doctores"),
    });
  }

  loadPatients(): void {
    if (this.role() !== "DOCTOR") return;

    this.reportsService.getPatients().subscribe({
      next: (patients) => this.patients.set(patients),
      error: () => this.error.set("No se pudo cargar la lista de pacientes"),
    });
  }

  selectConversation(conversation: TeleconsultationSummary): void {
    const previous = this.selectedConversation();
    if (previous) {
      this.teleconsultationService.leave(previous.id);
    }

    this.selectedConversation.set(conversation);
    this.messages.set([]);
    this.error.set(null);

    this.teleconsultationService
      .join(conversation.id)
      .then(() => {
        this.teleconsultationService.getMessages(conversation.id).subscribe({
          next: (messages) => this.messages.set(messages),
          error: () => this.error.set("No se pudo cargar el historial"),
        });
      })
      .catch(() => this.error.set("No tienes acceso a esta conversación"));
  }

  createConversation(): void {
    const patientId = this.currentPatientId();
    if (!patientId) {
      this.error.set("No se encontró tu perfil de paciente en el token");
      return;
    }

    if (!this.selectedDoctorId || !this.newPurpose.trim()) {
      this.error.set("Selecciona un doctor e indica el motivo");
      return;
    }

    this.loading.set(true);
    this.teleconsultationService
      .create({
        patientId,
        professionalId: Number(this.selectedDoctorId),
        purpose: this.newPurpose.trim(),
      })
      .subscribe({
        next: (conversation) => {
          this.conversations.update((items) => [conversation, ...items]);
          this.newPurpose = "";
          this.selectedDoctorId = null;
          this.loading.set(false);
          this.selectConversation(conversation);
        },
        error: (err) => {
          this.error.set(
            err?.error?.error || "No se pudo crear la teleconsulta",
          );
          this.loading.set(false);
        },
      });
  }

  createMeetAppointment(): void {
    const doctorId = this.currentUserId();

    if (!doctorId) {
      this.error.set("No se encontró el usuario doctor en el token");
      return;
    }

    if (!this.meetPatientId || !this.meetDate || !this.meetTime) {
      this.error.set("Selecciona paciente, fecha y hora para la cita");
      return;
    }

    const meetUrl = this.generateMeetUrl();
    const notes = [this.meetNotes.trim(), `Enlace de videochat: ${meetUrl}`]
      .filter(Boolean)
      .join("\n");

    this.creatingMeetAppointment.set(true);
    this.error.set(null);
    this.meetAppointmentUrl.set(null);

    this.appointmentsService
      .createAppointment({
        patientId: this.meetPatientId,
        doctorId,
        title: this.meetTitle.trim() || "Teleconsulta médica",
        date: this.meetDate,
        time: this.meetTime,
        place: meetUrl,
        notes,
      })
      .subscribe({
        next: () => {
          this.meetAppointmentUrl.set(meetUrl);
          this.creatingMeetAppointment.set(false);
          this.meetPatientId = null;
          this.meetTitle = "Teleconsulta médica";
          this.meetDate = "";
          this.meetTime = "";
          this.meetNotes = "";
        },
        error: (err) => {
          this.error.set(err?.error?.error || "No se pudo crear la cita");
          this.creatingMeetAppointment.set(false);
        },
      });
  }

  send(): void {
    const selected = this.selectedConversation();
    const content = this.newMessage.trim();
    if (
      !selected ||
      !content ||
      this.sending() ||
      selected.status === "closed"
    ) {
      return;
    }

    this.sending.set(true);
    this.teleconsultationService
      .sendMessage(selected.id, content)
      .then(() => {
        this.newMessage = "";
        this.sending.set(false);
      })
      .catch((error) => {
        this.error.set(error?.message || "No se pudo enviar el mensaje");
        this.sending.set(false);
      });
  }

  closeConversation(): void {
    const selected = this.selectedConversation();
    if (!selected || !this.canCloseConversation() || this.closing()) return;

    this.closing.set(true);
    this.teleconsultationService.close(selected.id).subscribe({
      next: (conversation) => {
        this.applyClosedConversation(conversation);
        this.closing.set(false);
      },
      error: (err) => {
        this.error.set(
          err?.error?.error || "No se pudo finalizar la teleconsulta",
        );
        this.closing.set(false);
      },
    });
  }

  downloadClinicalSummary(): void {
    const selected = this.selectedConversation();
    if (!selected || selected.status !== "closed" || this.generatingSummary()) {
      return;
    }

    this.generatingSummary.set(true);
    this.teleconsultationService
      .downloadClinicalSummaryPdf(selected.id)
      .subscribe({
        next: (response) => {
          const url = window.URL.createObjectURL(response);
          const link = document.createElement("a");
          link.href = url;
          link.download = `teleconsulta-${selected.id}-resumen-clinico.pdf`;
          link.click();
          window.URL.revokeObjectURL(url);
          this.generatingSummary.set(false);
        },
        error: (err) => {
          this.error.set(
            err?.error?.error ||
              "No se pudo generar el resumen clínico de la teleconsulta",
          );
          this.generatingSummary.set(false);
        },
      });
  }

  canWrite(): boolean {
    const selected = this.selectedConversation();
    return (
      !!selected &&
      selected.status !== "closed" &&
      selected.status !== "cancelled"
    );
  }

  canCloseConversation(): boolean {
    const selected = this.selectedConversation();
    return (
      !!selected &&
      selected.doctorUserId === this.currentUserId() &&
      selected.status !== "closed" &&
      selected.status !== "cancelled"
    );
  }

  canDownloadClinicalSummary(): boolean {
    const selected = this.selectedConversation();
    return !!selected && selected.status === "closed";
  }

  conversationTitle(conversation: TeleconsultationSummary): string {
    return conversation.doctorUserId === this.currentUserId()
      ? conversation.patientName
      : conversation.doctorName;
  }

  isOwnMessage(message: TeleconsultationMessage): boolean {
    return message.senderUserId === this.currentUserId();
  }

  formatDate(value: string | null): string {
    if (!value) return "";
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }

  trackById(_index: number, item: { id: number }): number {
    return item.id;
  }

  private generateMeetUrl(): string {
    const suffix = `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    return `https://meet.jit.si/automed-${suffix}`;
  }

  private applyClosedConversation(conversation: TeleconsultationSummary): void {
    this.conversations.update((items) =>
      items.map((item) => (item.id === conversation.id ? conversation : item)),
    );

    const selected = this.selectedConversation();
    if (selected?.id === conversation.id) {
      this.selectedConversation.set(conversation);
      this.newMessage = "";
    }
  }

  private decodeToken(): TokenPayload | null {
    const token = this.auth.getToken();
    if (!token) return null;

    try {
      const payload = token.split(".")[1];
      return JSON.parse(atob(payload)) as TokenPayload;
    } catch {
      return null;
    }
  }
}
