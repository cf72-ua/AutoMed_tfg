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
// @ts-ignore
import bcryptjs from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";

type Role = "PACIENTE" | "DOCTOR" | "ADMIN" | null;

export class AuthService {
  private jwtSecret =
    process.env.JWT_SECRET || "your_jwt_secret_key_change_in_production";

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
