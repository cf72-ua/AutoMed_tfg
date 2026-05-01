/**
 * Servicio de Autenticación para Angular
 */

import { Injectable, signal, Signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';

type Role = 'PACIENTE' | 'PROFESIONAL' | 'ADMIN' | null;

interface AuthToken {
  userId: number;
  dni: string;
  role: Role;
  iat?: number;
  exp?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUser$ = new BehaviorSubject<any>(null);

  // Signals
  private authenticatedSignal = signal<boolean>(this.hasToken());
  private currentRoleSignal = signal<Role>(this.extractRoleFromToken());

  constructor(private apiService: ApiService) {
    this.loadCurrentUser();
  }

  /**
   * Registrar nuevo usuario por DNI
   */
  register(dni: string, password: string, fullName: string): Observable<any> {
    return this.apiService.post('/auth/register', {
      dni,
      password,
      fullName
    }).pipe(
      tap((response: any) => {
        if (response.token) {
          this.setAuthToken(response.token, response.user);
        }
      })
    );
  }

  /**
   * Login por DNI
   */
  login(dni: string, password: string): Observable<any> {
    return this.apiService.post('/auth/login', {
      dni,
      password
    }).pipe(
      tap((response: any) => {
        if (response.token) {
          this.setAuthToken(response.token, response.user);
        }
      })
    );
  }

  /**
   * Logout
   */
  logout(): void {
    this.apiService.clearToken();
    this.currentUser$.next(null);
    this.authenticatedSignal.set(false);
    this.currentRoleSignal.set(null);
  }

  /**
   * Set authentication token and update signals
   */
  private setAuthToken(token: string, user: any): void {
    this.apiService.setToken(token);
    this.currentUser$.next(user);
    this.authenticatedSignal.set(true);
    
    // Extraer rol del token decodificado
    const role = this.extractRoleFromToken();
    this.currentRoleSignal.set(role);
  }

  /**
   * IsLoggedIn (Signal) - llamar como función
   */
  isLoggedIn(): Signal<boolean> {
    return this.authenticatedSignal.asReadonly();
  }

  /**
   * Get current role (Signal) - llamar como función
   */
  getRole(): Signal<Role> {
    return this.currentRoleSignal.asReadonly();
  }

  /**
   * Get current user
   */
  getCurrentUser(): Observable<any> {
    return this.currentUser$.asObservable();
  }

  /**
   * Get token
   */
  getToken(): string | null {
    return this.apiService.getToken();
  }

  /**
   * Check if has token
   */
  private hasToken(): boolean {
    return !!this.getToken();
  }

  /**
   * Extract role from JWT token
   */
  private extractRoleFromToken(): Role {
    const token = this.getToken();
    if (!token) return null;
    
    try {
      // Decodificar JWT (sin verificar firma en cliente)
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.warn('Invalid token format');
        return null;
      }
      
      // Agregar padding si es necesario
      let payload = parts[1];
      const padding = 4 - (payload.length % 4);
      if (padding !== 4) {
        payload += '='.repeat(padding);
      }
      
      const decoded = JSON.parse(atob(payload)) as AuthToken;
      return decoded.role || null;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  /**
   * Load current user info
   */
  private loadCurrentUser(): void {
    const token = this.getToken();
    if (token) {
      // El usuario se carga desde el token
      this.authenticatedSignal.set(true);
      this.currentRoleSignal.set(this.extractRoleFromToken());
    }
  }

  /**
   * Get user roles (deprecated - use getRole() signal instead)
   */
  getUserRoles(): string[] {
    const token = this.getToken();
    if (!token) return [];
    const role = this.extractRoleFromToken();
    return role ? [role] : [];
  }

  /**
   * Refresh token
   */
  refreshToken(): Observable<any> {
    return this.apiService.post('/auth/refresh', {}).pipe(
      tap((response: any) => {
        if (response.token) {
          this.setAuthToken(response.token, response.user);
        }
      })
    );
  }
}
