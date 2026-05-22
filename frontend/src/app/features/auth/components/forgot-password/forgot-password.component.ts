import { Component, DestroyRef, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AuthService } from "@core/services/auth.service";

@Component({
  selector: "app-forgot-password",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: "./forgot-password.component.html",
  styleUrls: ["./forgot-password.component.scss"],
})
export class ForgotPasswordComponent {
  email = "";
  errorMessage = "";
  successMessage = "";
  isSubmitting = false;
  private destroyRef = inject(DestroyRef);

  constructor(private authService: AuthService) {}

  get isFormValid(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim());
  }

  onSubmit(): void {
    if (!this.isFormValid || this.isSubmitting) return;

    this.errorMessage = "";
    this.successMessage = "";
    this.isSubmitting = true;

    this.authService
      .forgotPassword(this.email.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.successMessage = response.message;
          this.email = "";
          this.isSubmitting = false;
        },
        error: (err) => {
          console.error("Forgot password error", err);
          this.errorMessage =
            err?.error?.error ||
            "No se ha podido enviar la nueva contraseña";
          this.isSubmitting = false;
        },
      });
  }
}
