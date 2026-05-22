/**
 * Servicio de Autenticación
 * Autenticación por DNI/NIE en lugar de email
 */

import {
  CreateUserDto,
  UserResponse,
  LoginDto,
  LoginResponse,
} from "@models/user.dto";
import { UserRole } from "../types/index.d";
import { getDatabase } from "../db/connection";
import { EmailService } from "./email.service";
// @ts-ignore
import bcryptjs from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import crypto from "crypto";

type Role = "PACIENTE" | "DOCTOR" | "ADMIN" | null;

export class AuthService {
  private jwtSecret =
    process.env.JWT_SECRET || "your_jwt_secret_key_change_in_production";
  private emailService = new EmailService();

  /**
   * Registrar nuevo usuario por DNI
   */
  async register(createUserDto: CreateUserDto): Promise<LoginResponse> {
    const { dni, password, fullName, email, phone } = createUserDto;
    const db = getDatabase();

    try {
      // Validar que el DNI no exista
      const [existingUsers]: any = await db.query(
        "SELECT id FROM users WHERE dni = ?",
        [dni],
      );

      if (existingUsers.length > 0) {
        throw new Error("El DNI ya está registrado");
      }

      // Hashear contraseña
      const hashedPassword = await bcryptjs.hash(password, 10);

      // Insertar usuario
      const [result]: any = await db.query(
        "INSERT INTO users (dni, password_hash, full_name, email, phone, status) VALUES (?, ?, ?, ?, ?, ?)",
        [dni, hashedPassword, fullName, email || null, phone || null, "active"],
      );

      const userId = result.insertId;

      // Asignar rol PACIENTE por defecto
      await this.assignRoleToUser(userId, "PACIENTE");

      // Crear perfil de paciente
      await db.query("INSERT INTO patient_profiles (user_id) VALUES (?)", [
        userId,
      ]);

      // Obtener usuario creado
      const user = await this.getUserById(userId);
      const token = await this.generateToken(user, "PACIENTE");

      return {
        token,
        user,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Asignar rol a usuario
   */
  private async assignRoleToUser(
    userId: number,
    roleName: string,
  ): Promise<void> {
    const db = getDatabase();

    try {
      // Obtener ID del rol
      const [roles]: any = await db.query(
        "SELECT id FROM roles WHERE name = ?",
        [roleName],
      );

      if (roles.length === 0) {
        // Crear rol si no existe
        const [roleResult]: any = await db.query(
          "INSERT INTO roles (name) VALUES (?)",
          [roleName],
        );

        const roleId = roleResult.insertId;

        // Asignar rol al usuario
        await db.query(
          "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
          [userId, roleId],
        );
      } else {
        const roleId = roles[0].id;
        await db.query(
          "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
          [userId, roleId],
        );
      }
    } catch (error) {
      console.error("Error assigning role:", error);
      throw error;
    }
  }

  /**
   * Login de usuario por DNI
   */
  async login(loginDto: LoginDto): Promise<LoginResponse> {
    const { dni, password } = loginDto;
    const db = getDatabase();

    try {
      // Buscar usuario por DNI
      const [users]: any = await db.query(
        `SELECT u.id, u.dni, u.password_hash, u.full_name, u.email, u.phone, u.status, 
                r.name as role
         FROM users u
         LEFT JOIN user_roles ur ON u.id = ur.user_id
         LEFT JOIN roles r ON ur.role_id = r.id
         WHERE u.dni = ?`,
        [dni],
      );

      if (users.length === 0) {
        throw new Error("DNI o contraseña incorrectos");
      }

      const user = users[0];

      // Validar contraseña
      const isPasswordValid = await bcryptjs.compare(
        password,
        user.password_hash,
      );
      if (!isPasswordValid) {
        throw new Error("DNI o contraseña incorrectos");
      }

      if (user.status !== "active") {
        throw new Error("Usuario inactivo. Contacta con administración");
      }

      // Obtener usuario con datos adicionales
      const userWithRole = await this.getUserById(user.id);
      const token = await this.generateToken(userWithRole, user.role);

      return {
        token,
        user: userWithRole,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generar una contraseña nueva y enviarla al correo del usuario.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const db = getDatabase();
    const normalizedEmail = email.trim().toLowerCase();
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [users]: any = await connection.query(
        "SELECT id, full_name, email FROM users WHERE LOWER(email) = ?",
        [normalizedEmail],
      );

      if (users.length === 0) {
        throw new Error("No existe ningún usuario con ese correo");
      }

      const user = users[0];
      const newPassword = this.generateTemporaryPassword();
      const hashedPassword = await bcryptjs.hash(newPassword, 10);

      await connection.query(
        "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [hashedPassword, user.id],
      );

      await this.emailService.sendMail({
        to: user.email,
        subject: "Tu nueva contraseña de AutoMed",
        text: this.buildForgotPasswordText(user.full_name, newPassword),
        html: this.buildForgotPasswordHtml(user.full_name, newPassword),
      });

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return {
      message: "Se ha enviado una nueva contraseña al correo indicado",
    };
  }

  /**
   * Obtener usuario por ID con roles
   */
  private async getUserById(userId: number): Promise<UserResponse> {
    const db = getDatabase();

    const [users]: any = await db.query(
      "SELECT id, dni, email, full_name, phone, status, created_at, updated_at FROM users WHERE id = ?",
      [userId],
    );

    if (users.length === 0) {
      throw new Error("Usuario no encontrado");
    }

    return users[0];
  }

  private generateTemporaryPassword(): string {
    return `AutoMed-${crypto.randomBytes(6).toString("base64url")}`;
  }

  private buildForgotPasswordText(
    fullName: string | null,
    newPassword: string,
  ): string {
    return [
      `Hola ${fullName || "usuario"},`,
      "",
      "Hemos generado una nueva contraseña para tu cuenta de AutoMed.",
      "",
      `Nueva contraseña: ${newPassword}`,
      "",
      "Por seguridad, inicia sesión y cámbiala cuanto antes.",
      "",
      "Si no solicitaste este cambio, contacta con administración.",
      "",
      "AutoMed",
    ].join("\n");
  }

  private buildForgotPasswordHtml(
    fullName: string | null,
    newPassword: string,
  ): string {
    const safeName = this.escapeHtml(fullName || "usuario");
    const safePassword = this.escapeHtml(newPassword);

    return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tu nueva contraseña de AutoMed</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f8fc;font-family:Arial,Helvetica,sans-serif;color:#1a2b3b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f8fc;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #dcecf7;border-radius:14px;overflow:hidden;box-shadow:0 12px 28px rgba(15,75,122,0.12);">
            <tr>
              <td style="background:#eaf6ff;padding:28px 30px 22px;text-align:center;border-bottom:4px solid #4e9d1d;">
                <div style="font-size:30px;font-weight:900;letter-spacing:0;color:#0f4b7a;line-height:1;">AutoMed</div>
                <div style="margin-top:8px;font-size:14px;font-weight:700;color:#31729c;">Atencion sanitaria conectada</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 30px 10px;">
                <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#0f4b7a;font-weight:900;">Nueva contraseña generada</h1>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#31485c;">Hola ${safeName}, hemos generado una nueva contraseña para que puedas volver a acceder a tu cuenta de AutoMed.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 24px;">
                <div style="background:#f7fbfe;border:1px solid #cfe4f3;border-radius:12px;padding:18px;text-align:center;">
                  <div style="font-size:13px;font-weight:800;text-transform:uppercase;color:#31729c;margin-bottom:10px;">Tu nueva contraseña</div>
                  <div style="display:inline-block;background:#0f4b7a;color:#ffffff;border-radius:10px;padding:14px 18px;font-size:22px;font-weight:900;letter-spacing:1px;font-family:Consolas,Menlo,Monaco,monospace;">${safePassword}</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 30px;">
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#31485c;">Por seguridad, inicia sesion y cambiala cuanto antes desde tu perfil.</p>
                <div style="background:#fff8e8;border-left:4px solid #f2b84b;border-radius:8px;padding:14px 16px;color:#5b4320;font-size:14px;line-height:1.5;">Si no solicitaste este cambio, contacta con administracion para revisar tu cuenta.</div>
              </td>
            </tr>
            <tr>
              <td style="background:#0f4b7a;padding:18px 30px;text-align:center;color:#d9eefb;font-size:13px;line-height:1.5;">
                AutoMed · Gestion medica digital
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Generar JWT token
   */
  private async generateToken(
    user: UserResponse,
    role: Role = "PACIENTE",
  ): Promise<string> {
    const db = getDatabase();

    // Obtener el patient_id del usuario
    let patientId: number | null = null;
    if (role === "PACIENTE") {
      try {
        const [patients]: any = await db.query(
          "SELECT id FROM patient_profiles WHERE user_id = ?",
          [user.id],
        );
        if (patients.length > 0) {
          patientId = patients[0].id;
        }
      } catch (error) {
        console.error("Error getting patient profile:", error);
      }
    }

    const payload = {
      userId: user.id,
      patientId: patientId,
      dni: user.dni,
      role: role || "PACIENTE",
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn: "7d" } as any);
  }

  /**
   * Validar token JWT
   */
  async validateToken(token: string): Promise<any> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      return decoded;
    } catch (error) {
      throw new Error("Token inválido o expirado");
    }
  }

  /**
   * Refresh token
   */
  async refreshToken(token: string): Promise<LoginResponse> {
    try {
      const decoded = await this.validateToken(token);
      const user = await this.getUserById(decoded.userId);
      const newToken = await this.generateToken(user, decoded.role);

      return {
        token: newToken,
        user,
      };
    } catch (error) {
      throw error;
    }
  }
}
