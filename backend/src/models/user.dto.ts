/**
 * Modelos/DTOs de Usuario
 */

export interface CreateUserDto {
  dni: string;
  password: string;
  fullName: string;
  email?: string;
  phone?: string;
}

export interface UpdateUserDto {
  fullName?: string;
  email?: string;
  phone?: string;
  status?: string;
}

export interface UserResponse {
  id: number;
  dni: string;
  email?: string;
  fullName: string;
  phone?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginDto {
  dni: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: UserResponse;
}
