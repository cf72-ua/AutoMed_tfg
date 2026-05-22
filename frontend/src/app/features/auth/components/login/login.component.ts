import { Component, DestroyRef, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, RouterModule } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AuthService } from "@core/services/auth.service";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: "./login.component.html",
  styleUrls: ["./login.component.scss"],
})
export class LoginComponent {
  dni = "";
  password = "";
  errorMessage = "";
  isSubmitting = false;
  private destroyRef = inject(DestroyRef);

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  get isFormValid(): boolean {
    return this.dni.trim().length > 0 && this.password.length > 0;
  }

  onSubmit(): void {
    if (!this.isFormValid || this.isSubmitting) return;

    this.errorMessage = "";
    this.isSubmitting = true;

    this.authService
      .login(this.dni, this.password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.router.navigate(["/calendar"]);
        },
        error: (err) => {
          console.error("Login error", err);
          this.errorMessage =
            err?.error?.error || "DNI o contraseña incorrectos";
          this.isSubmitting = false;
        },
      });
  }
}
