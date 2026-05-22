/**
 * Servicio de Autenticación para Angular
 */

import { Injectable, signal, Signal } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { ApiService } from "./api.service";

type Role = "PACIENTE" | "DOCTOR" | "ADMIN" | null;

export interface CurrentUser {
  id: number;
  dni: string;
  email?: string | null;
  full_name?: string;
  fullName?: string;
  phone?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

interface AuthToken {
  userId: number;
  dni: string;
  role?: Role;
  roles?: Role[];
  iat?: number;
  exp?: number;
}

@Injectable({
  providedIn: "root",
})
export class AuthService {
  private currentUser$ = new BehaviorSubject<CurrentUser | null>(
    this.getStoredUser(),
  );

  private authenticatedSignal = signal<boolean>(this.hasToken());
  private currentRoleSignal = signal<Role>(this.extractRoleFromToken());

  constructor(private apiService: ApiService) {
    this.loadCurrentUser();
  }

  /**
   * Registrar nuevo usuario por DNI
   */
  register(
    dni: string,
    password: string,
    fullName: string,
    email?: string,
  ): Observable<any> {
    return this.apiService
      .post("/auth/register", {
        dni,
        password,
        fullName,
        email,
      })
      .pipe(
        tap((response: any) => {
          if (response.token) {
            this.setAuthToken(response.token, response.user);
          }
        }),
      );
  }

  /**
   * Login por DNI
   */
  login(dni: string, password: string): Observable<any> {
    return this.apiService
      .post("/auth/login", {
        dni,
        password,
      })
      .pipe(
        tap((response: any) => {
          if (response.token) {
            this.setAuthToken(response.token, response.user);
          }
        }),
      );
  }

  /**
   * Solicitar una contraseña nueva por correo
   */
  forgotPassword(email: string): Observable<{ message: string }> {
    return this.apiService.post<{ message: string }>("/auth/forgot-password", {
      email,
    });
  }

  /**
   * Logout
   */
  logout(): void {
    this.apiService.clearToken();
    localStorage.removeItem("auth_user");
    this.currentUser$.next(null);
    this.authenticatedSignal.set(false);
    this.currentRoleSignal.set(null);
  }

  /**
   * Set authentication token and update signals
   */
  private setAuthToken(token: string, user: any): void {
    this.apiService.setToken(token);
    localStorage.setItem("auth_user", JSON.stringify(user));
    this.currentUser$.next(user);
    this.authenticatedSignal.set(true);

    
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
  getCurrentUser(): Observable<CurrentUser | null> {
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
      const parts = token.split(".");
      if (parts.length !== 3) {
        console.warn("Invalid token format");
        return null;
      }

      let payload = parts[1];
      const padding = 4 - (payload.length % 4);
      if (padding !== 4) {
        payload += "=".repeat(padding);
      }

      const decoded = JSON.parse(atob(payload)) as AuthToken;
      return decoded.role || decoded.roles?.[0] || null;
    } catch (error) {
      console.error("Error decoding token:", error);
      return null;
    }
  }

  /**
   * Load current user info
   */
  private loadCurrentUser(): void {
    const token = this.getToken();
    if (token) {
      this.authenticatedSignal.set(true);
      this.currentRoleSignal.set(this.extractRoleFromToken());
      this.currentUser$.next(this.getStoredUser());
    }
  }

  private getStoredUser(): CurrentUser | null {
    const rawUser = localStorage.getItem("auth_user");
    if (!rawUser) return null;

    try {
      return JSON.parse(rawUser) as CurrentUser;
    } catch (error) {
      console.error("Error parsing stored user:", error);
      localStorage.removeItem("auth_user");
      return null;
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
    return this.apiService.post("/auth/refresh", {}).pipe(
      tap((response: any) => {
        if (response.token) {
          this.setAuthToken(response.token, response.user);
        }
      }),
    );
  }
}
