/**
 * Controlador de Firmas de Profesionales
 * Endpoints para upload, gestión y activación de firmas digitales
 */

import { Request, Response } from "express";
import { ProfessionalSignatureService } from "../services/signature.service";
import { handleErrorResponse } from "../helpers/error.handler";
import multer from "multer";
import * as path from "path";
import * as fs from "fs";

// Configurar multer para upload de imágenes
const storage = multer.memoryStorage();

const fileFilter = (req: any, file: any, cb: Function) => {
  // Solo permitir PNG
  if (file.mimetype === "image/png") {
    cb(null, true);
  } else {
    cb(new Error("Solo se permiten archivos PNG"), false);
  }
};

export const uploadSignature = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  },
});

export class SignatureController {
  private signatureService = new ProfessionalSignatureService();

  /**
   * Upload de nueva firma (solo DOCTOR)
   */
  async uploadSignature(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const userRoles = (req as any).user?.roles || [];
      const namePrinted = req.body.namePrinted;

      if (!userId) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      if (!userRoles.includes("DOCTOR")) {
        res
          .status(403)
          .json({ error: "Solo profesionales pueden subir firmas" });
        return;
      }

      const file = (req as any).file;
      if (!file) {
        res.status(400).json({ error: "No se proporcionó archivo de imagen" });
        return;
      }

      if (!namePrinted) {
        res.status(400).json({ error: "namePrinted es requerido" });
        return;
      }

      // Obtener profesionalId desde userId
      const professionalId = await this.getProfessionalIdFromUserId(userId);

      if (!professionalId) {
        res.status(404).json({ error: "Perfil profesional no encontrado" });
        return;
      }

      const signature = await this.signatureService.createSignature(
        professionalId,
        file.buffer,
        namePrinted,
      );

      res.status(201).json(signature);
    } catch (error) {
      handleErrorResponse(res, error);
    }
  }

  /**
   * Listar todas las firmas del profesional
   */
  async listSignatures(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      const professionalId = await this.getProfessionalIdFromUserId(userId);

      if (!professionalId) {
        res.status(404).json({ error: "Perfil profesional no encontrado" });
        return;
      }

      const signatures =
        await this.signatureService.listProfessionalSignatures(professionalId);

      res.json(signatures);
    } catch (error) {
      handleErrorResponse(res, error);
    }
  }

  /**
   * Obtener firma activa
   */
  async getActiveSignature(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      const professionalId = await this.getProfessionalIdFromUserId(userId);

      if (!professionalId) {
        res.status(404).json({ error: "Perfil profesional no encontrado" });
        return;
      }

      const signature =
        await this.signatureService.getActiveProfessionalSignature(
          professionalId,
        );

      if (!signature) {
        res.status(404).json({ error: "No hay firma activa" });
        return;
      }

      res.json(signature);
    } catch (error) {
      handleErrorResponse(res, error);
    }
  }

  /**
   * Activar una firma existente
   */
  async activateSignature(req: Request, res: Response): Promise<void> {
    try {
      const signatureId = parseInt(req.params.signatureId);
      const userId = (req as any).user?.id;

      if (!signatureId) {
        res.status(400).json({ error: "ID de firma inválido" });
        return;
      }

      if (!userId) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      const professionalId = await this.getProfessionalIdFromUserId(userId);

      if (!professionalId) {
        res.status(404).json({ error: "Perfil profesional no encontrado" });
        return;
      }

      const signature = await this.signatureService.activateSignature(
        signatureId,
        professionalId,
      );

      res.json(signature);
    } catch (error) {
      handleErrorResponse(res, error);
    }
  }

  /**
   * Eliminar firma
   */
  async deleteSignature(req: Request, res: Response): Promise<void> {
    try {
      const signatureId = parseInt(req.params.signatureId);
      const userId = (req as any).user?.id;

      if (!signatureId) {
        res.status(400).json({ error: "ID de firma inválido" });
        return;
      }

      if (!userId) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      const professionalId = await this.getProfessionalIdFromUserId(userId);

      if (!professionalId) {
        res.status(404).json({ error: "Perfil profesional no encontrado" });
        return;
      }

      await this.signatureService.deleteSignature(signatureId, professionalId);

      res.json({ message: "Firma eliminada correctamente" });
    } catch (error) {
      handleErrorResponse(res, error);
    }
  }

  /**
   * Obtener ID profesional desde ID de usuario
   */
  private async getProfessionalIdFromUserId(
    userId: number,
  ): Promise<number | null> {
    const db = (await import("../db/connection")).getDatabase();
    const connection = await db.getConnection();
    try {
      const [rows] = await connection.query(
        "SELECT id FROM professional_profiles WHERE user_id = ? LIMIT 1",
        [userId],
      );

      return (rows as any[])[0]?.id || null;
    } finally {
      connection.release();
    }
  }
}
