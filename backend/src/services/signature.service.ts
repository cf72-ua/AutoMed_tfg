/**
 * Servicio de Gestión de Firmas de Profesionales
 * Maneja upload, almacenamiento y activación de firmas digitales PNG
 */

import { getDatabase } from "../db/connection";
import {
  ProfessionalSignatureDTO,
  ProfessionalSignatureResponse,
} from "../models/report.dto";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

export class ProfessionalSignatureService {
  private signaturesStorageDir = path.join(
    process.cwd(),
    "../storage/signatures",
  );

  constructor() {
    // Crear directorio de almacenamiento si no existe
    if (!fs.existsSync(this.signaturesStorageDir)) {
      fs.mkdirSync(this.signaturesStorageDir, { recursive: true });
    }
  }

  /**
   * Crear nueva firma para profesional
   */
  async createSignature(
    professionalId: number,
    imageBuffer: Buffer,
    namePrinted: string,
  ): Promise<ProfessionalSignatureResponse> {
    const connection = await getDatabase().getConnection();
    try {
      // Calcular hash SHA256 de la imagen
      const imageHash = crypto
        .createHash("sha256")
        .update(imageBuffer)
        .digest("hex");

      // Generar nombre único para guardad la imagen
      const fileName = `signature-${professionalId}-${Date.now()}.png`;
      const filePath = path.join(this.signaturesStorageDir, fileName);

      // Guardar imagen
      fs.writeFileSync(filePath, imageBuffer);

      // Desactivar otras firmas activas de este profesional
      await connection.query(
        "UPDATE professional_signatures SET is_active = FALSE WHERE professional_id = ? AND is_active = TRUE",
        [professionalId],
      );

      // Insertar nueva firma
      const [result] = await connection.query(
        `INSERT INTO professional_signatures (professional_id, image_url, image_hash, name_printed, is_active)
        VALUES (?, ?, ?, ?, TRUE)`,
        [professionalId, `/signatures/${fileName}`, imageHash, namePrinted],
      );

      const signatureId = (result as any).insertId;

      return this.getSignatureById(signatureId);
    } finally {
      connection.release();
    }
  }

  /**
   * Obtener firma por ID
   */
  async getSignatureById(
    signatureId: number,
  ): Promise<ProfessionalSignatureResponse> {
    const connection = await getDatabase().getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT ps.id, ps.professional_id, ps.image_url, ps.name_printed, ps.is_active, 
                ps.created_at, ps.updated_at
        FROM professional_signatures ps
        WHERE ps.id = ?`,
        [signatureId],
      );

      if ((rows as any[]).length === 0) {
        throw new Error(`Firma no encontrada: ${signatureId}`);
      }

      const row = (rows as any[])[0];
      return {
        id: row.id,
        professionalId: row.professional_id,
        imageUrl: row.image_url,
        imageName: row.image_url.split("/").pop() || "",
        namePrinted: row.name_printed,
        isActive: row.is_active,
        createdAt: row.created_at,
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Obtener firma activa de profesional
   */
  async getActiveProfessionalSignature(
    professionalId: number,
  ): Promise<ProfessionalSignatureResponse | null> {
    const connection = await getDatabase().getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT id, professional_id, image_url, name_printed, is_active, created_at, updated_at
        FROM professional_signatures
        WHERE professional_id = ? AND is_active = TRUE
        LIMIT 1`,
        [professionalId],
      );

      if ((rows as any[]).length === 0) {
        return null;
      }

      const row = (rows as any[])[0];
      return {
        id: row.id,
        professionalId: row.professional_id,
        imageUrl: row.image_url,
        imageName: row.image_url.split("/").pop() || "",
        namePrinted: row.name_printed,
        isActive: row.is_active,
        createdAt: row.created_at,
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Listar todas las firmas de un profesional
   */
  async listProfessionalSignatures(
    professionalId: number,
  ): Promise<ProfessionalSignatureResponse[]> {
    const connection = await getDatabase().getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT id, professional_id, image_url, name_printed, is_active, created_at, updated_at
        FROM professional_signatures
        WHERE professional_id = ?
        ORDER BY created_at DESC`,
        [professionalId],
      );

      return (rows as any[]).map((row) => ({
        id: row.id,
        professionalId: row.professional_id,
        imageUrl: row.image_url,
        imageName: row.image_url.split("/").pop() || "",
        namePrinted: row.name_printed,
        isActive: row.is_active,
        createdAt: row.created_at,
      }));
    } finally {
      connection.release();
    }
  }

  /**
   * Activar firma existente
   */
  async activateSignature(
    signatureId: number,
    professionalId: number,
  ): Promise<ProfessionalSignatureResponse> {
    const connection = await getDatabase().getConnection();
    try {
      // Verificar que la firma pertenece al profesional
      const signature = await this.getSignatureById(signatureId);
      if (signature.professionalId !== professionalId) {
        throw new Error("No tienes permiso para activar esta firma");
      }

      // Desactivar otras firmas
      await connection.query(
        "UPDATE professional_signatures SET is_active = FALSE WHERE professional_id = ? AND id != ?",
        [professionalId, signatureId],
      );

      // Activar esta firma
      await connection.query(
        "UPDATE professional_signatures SET is_active = TRUE WHERE id = ?",
        [signatureId],
      );

      return this.getSignatureById(signatureId);
    } finally {
      connection.release();
    }
  }

  /**
   * Eliminar firma
   */
  async deleteSignature(
    signatureId: number,
    professionalId: number,
  ): Promise<void> {
    const connection = await getDatabase().getConnection();
    try {
      // Verificar propiedad
      const signature = await this.getSignatureById(signatureId);
      if (signature.professionalId !== professionalId) {
        throw new Error("No tienes permiso para eliminar esta firma");
      }

      // Eliminar archivo físico
      const filePath = path.join(process.cwd(), "..", signature.imageUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Eliminar de BD
      await connection.query(
        "DELETE FROM professional_signatures WHERE id = ?",
        [signatureId],
      );
    } finally {
      connection.release();
    }
  }

  /**
   * Validar integridad de firma (verificar hash)
   */
  async verifySignatureIntegrity(
    signatureId: number,
    imageBuffer: Buffer,
  ): Promise<boolean> {
    const signature = await this.getSignatureById(signatureId);
    const calculatedHash = crypto
      .createHash("sha256")
      .update(imageBuffer)
      .digest("hex");

    // En BD guardamos el hash, comparar
    const connection = await getDatabase().getConnection();
    try {
      const [rows] = await connection.query(
        "SELECT image_hash FROM professional_signatures WHERE id = ?",
        [signatureId],
      );

      if ((rows as any[]).length === 0) {
        return false;
      }

      const storedHash = (rows as any[])[0].image_hash;
      return storedHash === calculatedHash;
    } finally {
      connection.release();
    }
  }
}
