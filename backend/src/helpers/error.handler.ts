/**
 * Manejador centralizado de errores
 */

import { Response } from "express";

export interface ErrorResponse {
  message: string;
  status: number;
  details?: any;
}

export const handleErrorResponse = (
  res: Response,
  error: any,
  defaultStatus: number = 500,
) => {
  // Si es un error conocido con estructura
  if (error.status && error.message) {
    return res.status(error.status).json({
      message: error.message,
      details: error.details || undefined,
    });
  }

  // Si es un error de base de datos
  if (
    error.code &&
    (error.code.startsWith("ER") || error.code === "PROTOCOL_CONNECTION_LOST")
  ) {
    return res.status(500).json({
      message: "Database error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }

  // Si es un error de validación
  if (error.validationError) {
    return res.status(400).json({
      message: "Validation error",
      details: error.message,
    });
  }

  // Error genérico
  return res.status(defaultStatus).json({
    message: error.message || "Internal server error",
    details: process.env.NODE_ENV === "development" ? error : undefined,
  });
};

export const asyncHandler = (fn: Function) => {
  return (...args: any[]) => Promise.resolve(fn(...args)).catch(args[2]);
};
