/**
 * Controlador de Autenticación
 */

import { Router, Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { CreateUserDto, ForgotPasswordDto, LoginDto } from "../models/user.dto";

const authRouter = Router();
const authService = new AuthService();

/**
 * POST /api/auth/register
 * Registrar nuevo usuario
 */
authRouter.post("/register", async (req: Request, res: Response) => {
  try {
    const createUserDto: CreateUserDto = req.body;

    // Validar datos requeridos
    if (
      !createUserDto.dni ||
      !createUserDto.password ||
      !createUserDto.fullName
    ) {
      return res.status(400).json({
        error: "DNI, contraseña y nombre completo son requeridos",
      });
    }

    const result = await authService.register(createUserDto);
    res.status(201).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Registration failed";
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/auth/login
 * Login de usuario
 */
authRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const loginDto: LoginDto = req.body;

    // Validar datos requeridos
    if (!loginDto.dni || !loginDto.password) {
      return res.status(400).json({
        error: "DNI y contraseña son requeridos",
      });
    }

    const result = await authService.login(loginDto);
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid credentials";
    res.status(401).json({ error: message });
  }
});

/**
 * POST /api/auth/forgot-password
 * Generar y enviar una contraseña nueva al correo del usuario
 */
authRouter.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const forgotPasswordDto: ForgotPasswordDto = req.body;
    const email = forgotPasswordDto.email?.trim();

    if (!email) {
      return res.status(400).json({
        error: "El correo es requerido",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: "El correo no es válido",
      });
    }

    const result = await authService.forgotPassword(email);
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Password recovery failed";
    const status =
      message === "No existe ningún usuario con ese correo" ? 404 : 500;
    res.status(status).json({ error: message });
  }
});

/**
 * POST /api/auth/refresh
 * Refrescar token
 */
authRouter.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token es requerido" });
    }

    const result = await authService.refreshToken(token);
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Token refresh failed";
    res.status(401).json({ error: message });
  }
});

/**
 * POST /api/auth/logout
 * Logout
 */
authRouter.post("/logout", (req: Request, res: Response) => {
  // En este caso, el logout es principalmente en cliente (eliminar token localStorage)
  res.status(200).json({ message: "Logged out successfully" });
});

export default authRouter;
