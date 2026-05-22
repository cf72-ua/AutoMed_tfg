import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { BehaviorSubject, Observable } from "rxjs";
import { environment } from "@environments/environment";

@Injectable({
  providedIn: "root",
})
export class ApiService {
  private apiUrl = environment.apiUrl;
  private authToken$ = new BehaviorSubject<string | null>(this.getToken());

  constructor(private http: HttpClient) {}

  /**
   * GET request
   */
  get<T>(endpoint: string, options?: any): Observable<T> {
    const headers = this.getHeaders();
    const config = { ...options, headers };
    return this.http.get<T>(
      `${this.apiUrl}${endpoint}`,
      config,
    ) as Observable<T>;
  }

  /**
   * POST request
   */
  post<T>(endpoint: string, body: any, options?: any): Observable<T> {
    const headers = this.getHeaders();
    const config = { ...options, headers };
    return this.http.post<T>(
      `${this.apiUrl}${endpoint}`,
      body,
      config,
    ) as Observable<T>;
  }

  /**
   * POST request para descargar binarios
   */
  postBlob(endpoint: string, body: any, options?: any): Observable<Blob> {
    const headers = this.getHeaders();
    const config = { ...options, headers, responseType: "blob" as const };
    return this.http.post(
      `${this.apiUrl}${endpoint}`,
      body,
      config,
    ) as unknown as Observable<Blob>;
  }

  /**
   * PUT request
   */
  put<T>(endpoint: string, body: any, options?: any): Observable<T> {
    const headers = this.getHeaders();
    const config = { ...options, headers };
    return this.http.put<T>(
      `${this.apiUrl}${endpoint}`,
      body,
      config,
    ) as Observable<T>;
  }

  /**
   * PATCH request
   */
  patch<T>(endpoint: string, body: any, options?: any): Observable<T> {
    const headers = this.getHeaders();
    const config = { ...options, headers };
    return this.http.patch<T>(
      `${this.apiUrl}${endpoint}`,
      body,
      config,
    ) as Observable<T>;
  }

  /**
   * DELETE request
   */
  delete<T>(endpoint: string, options?: any): Observable<T> {
    const headers = this.getHeaders();
    const config = { ...options, headers };
    return this.http.delete<T>(
      `${this.apiUrl}${endpoint}`,
      config,
    ) as Observable<T>;
  }

  /**
   * Set auth token
   */
  setToken(token: string): void {
    localStorage.setItem("auth_token", token);
    this.authToken$.next(token);
  }

  /**
   * Get auth token
   */
  getToken(): string | null {
    return localStorage.getItem("auth_token");
  }

  /**
   * Clear auth token
   */
  clearToken(): void {
    localStorage.removeItem("auth_token");
    this.authToken$.next(null);
  }

  /**
   * Get HTTP headers with auth token
   */
  private getHeaders(): HttpHeaders {
    const token = this.getToken();
    let headers = new HttpHeaders({
      "Content-Type": "application/json",
    });

    if (token) {
      headers = headers.set("Authorization", `Bearer ${token}`);
    }

    return headers;
  }
}
