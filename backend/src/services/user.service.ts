/**
 * Servicio de Usuario
 */

import { UserResponse, UpdateUserDto } from '@models/user.dto';

export class UserService {
  /**
   * Obtener usuario por ID
   */
  async getUserById(userId: number): Promise<UserResponse> {
    // Implementar: buscar usuario en BD
    throw new Error('Not implemented');
  }

  /**
   * Obtener usuario por email
   */
  async getUserByEmail(email: string): Promise<UserResponse | null> {
    // Implementar: buscar usuario en BD por email
    throw new Error('Not implemented');
  }

  /**
   * Actualizar usuario
   */
  async updateUser(userId: number, updateUserDto: UpdateUserDto): Promise<UserResponse> {
    // Implementar: validar y actualizar en BD
    throw new Error('Not implemented');
  }

  /**
   * Obtener todos los usuarios (admin)
   */
  async getAllUsers(page: number = 1, limit: number = 10): Promise<any> {
    // Implementar: paginación
    throw new Error('Not implemented');
  }

  /**
   * Cambiar contraseña
   */
  async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<void> {
    // Implementar: validar y cambiar contraseña
    throw new Error('Not implemented');
  }
}
