/**
 * Componente: Gestor de Firmas Digitales
 */

import { Component, OnInit } from "@angular/core";
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { CommonModule } from "@angular/common";
import {
  SignaturesService,
  ProfessionalSignature,
} from "../../core/services/signatures.service";
import { LoadingSpinnerComponent } from "../../shared/components/loading-spinner/loading-spinner.component";

@Component({
  selector: "app-signature-manager",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LoadingSpinnerComponent],
  templateUrl: "./signature-manager.component.html",
  styleUrls: ["./signature-manager.component.scss"],
})
export class SignatureManagerComponent implements OnInit {
  uploadForm: FormGroup;
  signatures: ProfessionalSignature[] = [];
  isLoading = false;
  isUploading = false;
  filePreview: string | null = null;

  constructor(
    private fb: FormBuilder,
    private signaturesService: SignaturesService,
  ) {
    this.uploadForm = this.fb.group({
      file: ["", Validators.required],
      namePrinted: ["", [Validators.required, Validators.minLength(3)]],
    });
  }

  ngOnInit(): void {
    this.loadSignatures();
  }

  loadSignatures(): void {
    this.isLoading = true;
    this.signaturesService.listSignatures().subscribe({
      next: (signatures) => {
        this.signatures = signatures;
        this.isLoading = false;
      },
      error: (error) => {
        console.error("Error loading signatures:", error);
        this.isLoading = false;
      },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      
      if (file.type !== "image/png") {
        alert("Solo se permiten archivos PNG");
        return;
      }

      
      const reader = new FileReader();
      reader.onload = (e) => {
        this.filePreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  onUpload(): void {
    if (!this.uploadForm.valid || !this.uploadForm.get("file")?.value) return;

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = fileInput.files?.[0];

    if (!file) return;

    this.isUploading = true;
    const namePrinted = this.uploadForm.get("namePrinted")?.value;

    this.signaturesService.uploadSignature(file, namePrinted).subscribe({
      next: (signature) => {
        this.signatures.push(signature);
        this.uploadForm.reset();
        this.filePreview = null;
        this.isUploading = false;
        alert("Firma subida correctamente");
        this.loadSignatures();
      },
      error: (error) => {
        console.error("Error uploading signature:", error);
        alert("Error al subir la firma");
        this.isUploading = false;
      },
    });
  }

  activateSignature(signatureId: number): void {
    if (!confirm("¿Activar esta firma?")) return;

    this.signaturesService.activateSignature(signatureId).subscribe({
      next: () => {
        this.loadSignatures();
        alert("Firma activada correctamente");
      },
      error: (error) => {
        console.error("Error activating signature:", error);
        alert("Error al activar la firma");
      },
    });
  }

  deleteSignature(signatureId: number): void {
    if (!confirm("¿Estás seguro de que quieres eliminar esta firma?")) return;

    this.signaturesService.deleteSignature(signatureId).subscribe({
      next: () => {
        this.loadSignatures();
        alert("Firma eliminada correctamente");
      },
      error: (error) => {
        console.error("Error deleting signature:", error);
        alert("Error al eliminar la firma");
      },
    });
  }
}
