/** 
 * Tipos globales para la aplicación
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: any;
  timestamp: Date;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export enum UserRole {
  PACIENTE = 'PACIENTE',
  PROFESIONAL = 'PROFESIONAL',
  ADMIN = 'ADMIN'
}

export interface JwtPayload {
  userId: number;
  dni: string;
  roles: UserRole[];
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: number;
  dni: string;
  fullName: string;
  roles: UserRole[];
}
