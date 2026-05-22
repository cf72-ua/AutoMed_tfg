import { ResultSetHeader } from "mysql2";
import { getDatabase } from "../db/connection";

export type TeleconsultationStatus =
  | "scheduled"
  | "active"
  | "closed"
  | "cancelled";

export interface TeleconsultationParticipant {
  id: number;
  dni: string;
  fullName: string;
}

export interface TeleconsultationSummary {
  id: number;
  patientId: number;
  patientUserId: number;
  patientName: string;
  professionalId: number;
  doctorUserId: number;
  doctorName: string;
  purpose: string;
  status: TeleconsultationStatus;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  lastMessage: string | null;
  lastMessageAt: Date | null;
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
  createdAt: Date;
}

export interface CreateTeleconsultationDto {
  patientId: number;
  professionalId?: number;
  doctorUserId?: number;
  purpose: string;
}

export class TeleconsultationService {
  async listForUser(userId: number): Promise<TeleconsultationSummary[]> {
    const db = getDatabase();
    const [rows]: any = await db.query(
      `
      SELECT
        c.id,
        c.patient_id as patientId,
        patient_user.id as patientUserId,
        patient_user.full_name as patientName,
        c.professional_id as professionalId,
        doctor_user.id as doctorUserId,
        doctor_user.full_name as doctorName,
        c.purpose,
        c.status,
        c.started_at as startedAt,
        c.ended_at as endedAt,
        c.created_at as createdAt,
        last_msg.content as lastMessage,
        last_msg.created_at as lastMessageAt,
        last_msg.sender_user_id as lastMessageSenderUserId
      FROM consultations c
      INNER JOIN patient_profiles patient_profile ON c.patient_id = patient_profile.id
      INNER JOIN users patient_user ON patient_profile.user_id = patient_user.id
      INNER JOIN professional_profiles doctor_profile ON c.professional_id = doctor_profile.id
      INNER JOIN users doctor_user ON doctor_profile.user_id = doctor_user.id
      LEFT JOIN messages last_msg ON last_msg.id = (
        SELECT m.id
        FROM messages m
        WHERE m.consultation_id = c.id
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 1
      )
      WHERE patient_user.id = ? OR doctor_user.id = ?
      ORDER BY COALESCE(last_msg.created_at, c.created_at) DESC
      `,
      [userId, userId],
    );

    return rows;
  }

  async listDoctors(): Promise<TeleconsultationParticipant[]> {
    const db = getDatabase();
    const [rows]: any = await db.query(
      `
      SELECT
        pp.id,
        u.dni,
        u.full_name as fullName
      FROM professional_profiles pp
      INNER JOIN users u ON pp.user_id = u.id
      INNER JOIN user_roles ur ON u.id = ur.user_id
      INNER JOIN roles r ON ur.role_id = r.id
      WHERE r.name = 'DOCTOR' AND u.status = 'active'
      ORDER BY u.full_name ASC
      `,
    );

    return rows;
  }

  async getMessages(
    consultationId: number,
    userId: number,
  ): Promise<TeleconsultationMessage[]> {
    await this.assertParticipant(consultationId, userId);

    const db = getDatabase();
    const [rows]: any = await db.query(
      `
      SELECT
        m.id,
        m.consultation_id as consultationId,
        m.sender_user_id as senderUserId,
        u.full_name as senderName,
        CASE
          WHEN patient_profile.user_id = m.sender_user_id THEN 'PACIENTE'
          ELSE 'DOCTOR'
        END as senderRole,
        m.content,
        m.type,
        m.created_at as createdAt
      FROM messages m
      INNER JOIN users u ON m.sender_user_id = u.id
      INNER JOIN consultations c ON m.consultation_id = c.id
      INNER JOIN patient_profiles patient_profile ON c.patient_id = patient_profile.id
      WHERE m.consultation_id = ?
      ORDER BY m.created_at ASC, m.id ASC
      `,
      [consultationId],
    );

    return rows;
  }

  async create(
    dto: CreateTeleconsultationDto,
    requesterUserId: number,
    requesterRoles: string[],
  ): Promise<TeleconsultationSummary> {
    const purpose = dto.purpose?.trim();
    if (!purpose) {
      throw new Error("El motivo de la teleconsulta es obligatorio");
    }

    const professionalId =
      dto.professionalId ??
      (dto.doctorUserId
        ? await this.getProfessionalIdByUserId(dto.doctorUserId)
        : null);

    if (!professionalId) {
      throw new Error("Doctor no encontrado");
    }

    await this.assertPatientProfile(dto.patientId);
    await this.assertDoctorProfile(professionalId);

    const requesterIsPatient = requesterRoles.includes("PACIENTE");
    const requesterIsDoctor = requesterRoles.includes("DOCTOR");

    if (requesterIsPatient) {
      const patientUserId = await this.getPatientUserId(dto.patientId);
      if (patientUserId !== requesterUserId) {
        throw new Error("No puedes crear teleconsultas para otro paciente");
      }
    }

    if (requesterIsDoctor) {
      const doctorUserId = await this.getDoctorUserId(professionalId);
      if (doctorUserId !== requesterUserId) {
        throw new Error("No puedes crear teleconsultas para otro doctor");
      }
    }

    const db = getDatabase();
    const [result] = await db.query<ResultSetHeader>(
      `
      INSERT INTO consultations (patient_id, professional_id, purpose, status, started_at)
      VALUES (?, ?, ?, 'active', NOW())
      `,
      [dto.patientId, professionalId, purpose],
    );

    return this.getById(result.insertId, requesterUserId);
  }

  async createMessage(
    consultationId: number,
    senderUserId: number,
    content: string,
    type: "text" | "file" | "system" = "text",
  ): Promise<TeleconsultationMessage> {
    const cleanContent = content?.trim();
    if (!cleanContent) {
      throw new Error("El mensaje no puede estar vacío");
    }

    await this.assertParticipant(consultationId, senderUserId);
    await this.assertOpen(consultationId);

    const db = getDatabase();
    const [result] = await db.query<ResultSetHeader>(
      `
      INSERT INTO messages (consultation_id, sender_user_id, content, type)
      VALUES (?, ?, ?, ?)
      `,
      [consultationId, senderUserId, cleanContent, type],
    );

    await db.query(
      `
      UPDATE consultations
      SET status = CASE WHEN status = 'scheduled' THEN 'active' ELSE status END,
          started_at = COALESCE(started_at, NOW())
      WHERE id = ?
      `,
      [consultationId],
    );

    return this.getMessageById(result.insertId);
  }

  async close(
    consultationId: number,
    userId: number,
  ): Promise<TeleconsultationSummary> {
    await this.assertDoctorParticipant(consultationId, userId);

    const db = getDatabase();
    await db.query(
      `
      UPDATE consultations
      SET status = 'closed', ended_at = NOW()
      WHERE id = ? AND status <> 'closed'
      `,
      [consultationId],
    );

    return this.getById(consultationId, userId);
  }

  async assertParticipant(
    consultationId: number,
    userId: number,
  ): Promise<void> {
    const db = getDatabase();
    const [rows]: any = await db.query(
      `
      SELECT c.id
      FROM consultations c
      INNER JOIN patient_profiles patient_profile ON c.patient_id = patient_profile.id
      INNER JOIN professional_profiles doctor_profile ON c.professional_id = doctor_profile.id
      WHERE c.id = ?
        AND (patient_profile.user_id = ? OR doctor_profile.user_id = ?)
      LIMIT 1
      `,
      [consultationId, userId, userId],
    );

    if (rows.length === 0) {
      throw new Error("No tienes acceso a esta teleconsulta");
    }
  }

  async assertDoctorParticipant(
    consultationId: number,
    userId: number,
  ): Promise<void> {
    const db = getDatabase();
    const [rows]: any = await db.query(
      `
      SELECT c.id
      FROM consultations c
      INNER JOIN professional_profiles doctor_profile ON c.professional_id = doctor_profile.id
      WHERE c.id = ? AND doctor_profile.user_id = ?
      LIMIT 1
      `,
      [consultationId, userId],
    );

    if (rows.length === 0) {
      throw new Error("Solo el doctor de la teleconsulta puede finalizarla");
    }
  }

  async assertOpen(consultationId: number): Promise<void> {
    const db = getDatabase();
    const [rows]: any = await db.query(
      "SELECT status FROM consultations WHERE id = ? LIMIT 1",
      [consultationId],
    );

    if (rows.length === 0) {
      throw new Error("Teleconsulta no encontrada");
    }

    if (["closed", "cancelled"].includes(rows[0].status)) {
      throw new Error(
        "La teleconsulta está finalizada y no admite más mensajes",
      );
    }
  }

  async getById(
    consultationId: number,
    userId: number,
  ): Promise<TeleconsultationSummary> {
    await this.assertParticipant(consultationId, userId);

    const db = getDatabase();
    const [rows]: any = await db.query(
      `
      SELECT
        c.id,
        c.patient_id as patientId,
        patient_user.id as patientUserId,
        patient_user.full_name as patientName,
        c.professional_id as professionalId,
        doctor_user.id as doctorUserId,
        doctor_user.full_name as doctorName,
        c.purpose,
        c.status,
        c.started_at as startedAt,
        c.ended_at as endedAt,
        c.created_at as createdAt,
        last_msg.content as lastMessage,
        last_msg.created_at as lastMessageAt,
        last_msg.sender_user_id as lastMessageSenderUserId
      FROM consultations c
      INNER JOIN patient_profiles patient_profile ON c.patient_id = patient_profile.id
      INNER JOIN users patient_user ON patient_profile.user_id = patient_user.id
      INNER JOIN professional_profiles doctor_profile ON c.professional_id = doctor_profile.id
      INNER JOIN users doctor_user ON doctor_profile.user_id = doctor_user.id
      LEFT JOIN messages last_msg ON last_msg.id = (
        SELECT m.id
        FROM messages m
        WHERE m.consultation_id = c.id
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 1
      )
      WHERE c.id = ?
      LIMIT 1
      `,
      [consultationId],
    );

    if (rows.length === 0) {
      throw new Error("Teleconsulta no encontrada");
    }

    return rows[0];
  }

  private async getMessageById(
    messageId: number,
  ): Promise<TeleconsultationMessage> {
    const db = getDatabase();
    const [rows]: any = await db.query(
      `
      SELECT
        m.id,
        m.consultation_id as consultationId,
        m.sender_user_id as senderUserId,
        u.full_name as senderName,
        CASE
          WHEN patient_profile.user_id = m.sender_user_id THEN 'PACIENTE'
          ELSE 'DOCTOR'
        END as senderRole,
        m.content,
        m.type,
        m.created_at as createdAt
      FROM messages m
      INNER JOIN users u ON m.sender_user_id = u.id
      INNER JOIN consultations c ON m.consultation_id = c.id
      INNER JOIN patient_profiles patient_profile ON c.patient_id = patient_profile.id
      WHERE m.id = ?
      LIMIT 1
      `,
      [messageId],
    );

    if (rows.length === 0) {
      throw new Error("Mensaje no encontrado");
    }

    return rows[0];
  }

  private async getProfessionalIdByUserId(
    userId: number,
  ): Promise<number | null> {
    const db = getDatabase();
    const [rows]: any = await db.query(
      "SELECT id FROM professional_profiles WHERE user_id = ? LIMIT 1",
      [userId],
    );

    return rows.length > 0 ? Number(rows[0].id) : null;
  }

  private async getPatientUserId(patientId: number): Promise<number> {
    const db = getDatabase();
    const [rows]: any = await db.query(
      "SELECT user_id as userId FROM patient_profiles WHERE id = ? LIMIT 1",
      [patientId],
    );

    if (rows.length === 0) {
      throw new Error("Paciente no encontrado");
    }

    return Number(rows[0].userId);
  }

  private async getDoctorUserId(professionalId: number): Promise<number> {
    const db = getDatabase();
    const [rows]: any = await db.query(
      "SELECT user_id as userId FROM professional_profiles WHERE id = ? LIMIT 1",
      [professionalId],
    );

    if (rows.length === 0) {
      throw new Error("Doctor no encontrado");
    }

    return Number(rows[0].userId);
  }

  private async assertPatientProfile(patientId: number): Promise<void> {
    const db = getDatabase();
    const [rows]: any = await db.query(
      `
      SELECT pp.id
      FROM patient_profiles pp
      INNER JOIN users u ON pp.user_id = u.id
      INNER JOIN user_roles ur ON u.id = ur.user_id
      INNER JOIN roles r ON ur.role_id = r.id
      WHERE pp.id = ? AND r.name = 'PACIENTE'
      LIMIT 1
      `,
      [patientId],
    );

    if (rows.length === 0) {
      throw new Error("Paciente no encontrado");
    }
  }

  private async assertDoctorProfile(professionalId: number): Promise<void> {
    const db = getDatabase();
    const [rows]: any = await db.query(
      `
      SELECT pp.id
      FROM professional_profiles pp
      INNER JOIN users u ON pp.user_id = u.id
      INNER JOIN user_roles ur ON u.id = ur.user_id
      INNER JOIN roles r ON ur.role_id = r.id
      WHERE pp.id = ? AND r.name = 'DOCTOR'
      LIMIT 1
      `,
      [professionalId],
    );

    if (rows.length === 0) {
      throw new Error("Doctor no encontrado");
    }
  }
}
