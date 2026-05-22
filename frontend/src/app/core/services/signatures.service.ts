/**
 * Servicio Angular para Gestión de Firmas Digitales
 */

import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, BehaviorSubject } from "rxjs";
import { map, tap } from "rxjs/operators";
import { environment } from "../../../environments/environment";

export interface ProfessionalSignature {
  id: number;
  professionalId: number;
  imageUrl: string;
  imageName: string;
  namePrinted: string;
  isActive: boolean;
  createdAt: Date;
}

@Injectable({
  providedIn: "root",
})
export class SignaturesService {
  private apiUrl = `${environment.apiUrl}/signatures`;
  private assetsBaseUrl = environment.apiUrl.replace(/\/api\/?$/, "");
  private signaturesSubject = new BehaviorSubject<ProfessionalSignature[]>([]);
  public signatures$ = this.signaturesSubject.asObservable();

  private activeSignatureSubject =
    new BehaviorSubject<ProfessionalSignature | null>(null);
  public activeSignature$ = this.activeSignatureSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Subir nueva firma
   */
  uploadSignature(
    file: File,
    namePrinted: string,
  ): Observable<ProfessionalSignature> {
    const formData = new FormData();
    formData.append("signature", file);
    formData.append("namePrinted", namePrinted);

    return this.http
      .post<ProfessionalSignature>(`${this.apiUrl}/upload`, formData)
      .pipe(
        map((signature) => this.normalizeSignatureUrl(signature)),
        tap((signature) => {
          const current = this.signaturesSubject.value;
          this.signaturesSubject.next([...current, signature]);
          if (signature.isActive) {
            this.activeSignatureSubject.next(signature);
          }
        }),
      );
  }

  /**
   * Listar todas las firmas del profesional
   */
  listSignatures(): Observable<ProfessionalSignature[]> {
    return this.http.get<ProfessionalSignature[]>(this.apiUrl).pipe(
      map((signatures) =>
        signatures.map((signature) => this.normalizeSignatureUrl(signature)),
      ),
      tap((signatures) => this.signaturesSubject.next(signatures)),
    );
  }

  /**
   * Obtener firma activa
   */
  getActiveSignature(): Observable<ProfessionalSignature> {
    return this.http.get<ProfessionalSignature>(`${this.apiUrl}/active`).pipe(
      map((signature) => this.normalizeSignatureUrl(signature)),
      tap((signature) => this.activeSignatureSubject.next(signature)),
    );
  }

  /**
   * Activar firma existente
   */
  activateSignature(signatureId: number): Observable<ProfessionalSignature> {
    return this.http
      .put<ProfessionalSignature>(`${this.apiUrl}/${signatureId}/activate`, {})
      .pipe(
        map((signature) => this.normalizeSignatureUrl(signature)),
        tap((signature) => {
          const current = this.signaturesSubject.value.map((sig) => ({
            ...sig,
            isActive: sig.id === signatureId,
          }));
          this.signaturesSubject.next(current);
          this.activeSignatureSubject.next(signature);
        }),
      );
  }

  /**
   * Eliminar firma
   */
  deleteSignature(signatureId: number): Observable<void> {
    return (
      this.http.delete(
        `${this.apiUrl}/${signatureId}`,
      ) as unknown as Observable<void>
    ).pipe(
      tap(() => {
        const current = this.signaturesSubject.value.filter(
          (sig) => sig.id !== signatureId,
        );
        this.signaturesSubject.next(current);
      }),
    );
  }

  /**
   * Obtener firma por ID
   */
  getSignatureById(signatureId: number): ProfessionalSignature | undefined {
    return this.signaturesSubject.value.find((sig) => sig.id === signatureId);
  }

  /**
   * Actualizar caché de firmas
   */
  refreshSignatures(signatures: ProfessionalSignature[]): void {
    this.signaturesSubject.next(
      signatures.map((signature) => this.normalizeSignatureUrl(signature)),
    );
  }

  private normalizeSignatureUrl(
    signature: ProfessionalSignature,
  ): ProfessionalSignature {
    if (!signature.imageUrl || /^https?:\/\//.test(signature.imageUrl)) {
      return signature;
    }

    return {
      ...signature,
      imageUrl: `${this.assetsBaseUrl}${signature.imageUrl.startsWith("/") ? "" : "/"}${signature.imageUrl}`,
    };
  }
}
