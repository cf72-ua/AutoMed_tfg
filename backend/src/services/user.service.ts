/**
 * Servicio de Usuario
 */

import { UserResponse, UpdateUserDto } from "@models/user.dto";

export class UserService {
  /**
   * Obtener usuario por ID
   */
  async getUserById(userId: number): Promise<UserResponse> {
    throw new Error("Not implemented");
  }

  /**
   * Obtener usuario por email
   */
  async getUserByEmail(email: string): Promise<UserResponse | null> {
    throw new Error("Not implemented");
  }

  /**
   * Actualizar usuario
   */
  async updateUser(
    userId: number,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponse> {
    throw new Error("Not implemented");
  }

  /**
   * Obtener todos los usuarios (admin)
   */
  async getAllUsers(page: number = 1, limit: number = 10): Promise<any> {
    throw new Error("Not implemented");
  }

  /**
   * Cambiar contraseña
   */
  async changePassword(
    userId: number,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    throw new Error("");
  }
}
