import { signal } from "@angular/core";
import {
  ComponentFixture,
  fakeAsync,
  flushMicrotasks,
  TestBed,
} from "@angular/core/testing";
import { of, Subject } from "rxjs";
import { AppointmentsService } from "@core/services/appointments.service";
import { AuthService } from "@core/services/auth.service";
import { ReportsService } from "@core/services/reports.service";
import {
  TeleconsultationMessage,
  TeleconsultationService,
  TeleconsultationSummary,
} from "@core/services/teleconsultation.service";
import { TeleconsultationPage } from "./teleconsultation.page";

function token(payload: object): string {
  return ["header", btoa(JSON.stringify(payload)), "signature"].join(".");
}

describe("TeleconsultationPage", () => {
  let fixture: ComponentFixture<TeleconsultationPage>;
  let component: TeleconsultationPage;
  let messagesSubject: Subject<TeleconsultationMessage>;
  let teleconsultationService: jasmine.SpyObj<TeleconsultationService> & {
    messages$: Subject<TeleconsultationMessage>;
    closed$: Subject<TeleconsultationSummary>;
  };

  const conversation: TeleconsultationSummary = {
    id: 10,
    patientId: 21,
    patientUserId: 101,
    patientName: "Ana Paciente",
    professionalId: 7,
    doctorUserId: 202,
    doctorName: "Dra. Salud",
    purpose: "Consulta general",
    status: "active",
    startedAt: null,
    endedAt: null,
    createdAt: "2026-05-20T10:00:00Z",
    lastMessage: null,
    lastMessageAt: null,
    lastMessageSenderUserId: null,
  };

  beforeEach(async () => {
    messagesSubject = new Subject<TeleconsultationMessage>();
    teleconsultationService = jasmine.createSpyObj<TeleconsultationService>(
      "TeleconsultationService",
      [
        "connect",
        "disconnect",
        "list",
        "listDoctors",
        "getMessages",
        "join",
        "leave",
        "sendMessage",
      ],
      {
        messages$: messagesSubject,
        closed$: new Subject<TeleconsultationSummary>(),
      },
    ) as typeof teleconsultationService;

    teleconsultationService.list.and.returnValue(of([conversation]));
    teleconsultationService.listDoctors.and.returnValue(of([]));
    teleconsultationService.join.and.returnValue(Promise.resolve());
    teleconsultationService.getMessages.and.returnValue(
      of([
        {
          id: 1,
          consultationId: 10,
          senderUserId: 202,
          senderName: "Dra. Salud",
          senderRole: "DOCTOR",
          content: "Mensaje histórico",
          type: "text",
          createdAt: "2026-05-20T10:05:00Z",
        },
      ]),
    );

    await TestBed.configureTestingModule({
      imports: [TeleconsultationPage],
      providers: [
        { provide: TeleconsultationService, useValue: teleconsultationService },
        {
          provide: AppointmentsService,
          useValue: jasmine.createSpyObj<AppointmentsService>(
            "AppointmentsService",
            ["createAppointment"],
          ),
        },
        {
          provide: ReportsService,
          useValue: jasmine.createSpyObj<ReportsService>("ReportsService", [
            "getPatients",
          ]),
        },
        {
          provide: AuthService,
          useValue: {
            getRole: () => signal("PACIENTE"),
            getToken: () =>
              token({ userId: 101, patientId: 21, role: "PACIENTE" }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TeleconsultationPage);
    component = fixture.componentInstance;
  });

  it("carga conversaciones y el historial de mensajes al seleccionar la primera", fakeAsync(() => {
    fixture.detectChanges();
    flushMicrotasks();

    expect(teleconsultationService.connect).toHaveBeenCalled();
    expect(teleconsultationService.list).toHaveBeenCalled();
    expect(teleconsultationService.join).toHaveBeenCalledWith(10);
    expect(teleconsultationService.getMessages).toHaveBeenCalledWith(10);
    expect(component.selectedConversation()?.id).toBe(10);
    expect(component.messages().map((message) => message.content)).toEqual([
      "Mensaje histórico",
    ]);
  }));

  it("recibe mensajes en tiempo real y actualiza historial y conversación", fakeAsync(() => {
    fixture.detectChanges();
    flushMicrotasks();

    messagesSubject.next({
      id: 2,
      consultationId: 10,
      senderUserId: 202,
      senderName: "Dra. Salud",
      senderRole: "DOCTOR",
      content: "Mensaje en vivo",
      type: "text",
      createdAt: "2026-05-20T10:10:00Z",
    });

    expect(component.messages().map((message) => message.content)).toEqual([
      "Mensaje histórico",
      "Mensaje en vivo",
    ]);
    expect(component.conversations()[0].lastMessage).toBe("Mensaje en vivo");
  }));

  it("ignora mensajes en tiempo real de otra conversación", fakeAsync(() => {
    fixture.detectChanges();
    flushMicrotasks();

    messagesSubject.next({
      id: 3,
      consultationId: 999,
      senderUserId: 202,
      senderName: "Dra. Salud",
      senderRole: "DOCTOR",
      content: "Otro chat",
      type: "text",
      createdAt: "2026-05-20T10:20:00Z",
    });

    expect(component.messages().map((message) => message.content)).toEqual([
      "Mensaje histórico",
    ]);
  }));
});
