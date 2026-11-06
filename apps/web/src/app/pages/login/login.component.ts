import { Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { AuthService } from "../../core/auth/auth.service";

@Component({
  selector: "app-login",
  imports: [ReactiveFormsModule],
  templateUrl: "./login.component.html",
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group({
    email: ["", [Validators.required, Validators.email]],
    password: ["", Validators.required],
  });
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    try {
      await this.auth.login(email, password);
      await this.router.navigateByUrl("/hoy");
    } catch {
      this.error.set("Credenciales inválidas");
    } finally {
      this.loading.set(false);
    }
  }
}
