import { Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { AuthService } from "../../core/auth/auth.service";
import { rutaInicio } from "../../core/auth/inicio";
import { mensajeError } from "../../core/http/errores";

/** Accesos que la API todavía no soporta: se muestran, pero solo avisan. */
type AccesoPendiente = "recuperar" | "registro";

const AVISOS: Record<AccesoPendiente, string> = {
  recuperar: "Para restablecer tu contraseña, pídeselo al administrador del sistema.",
  registro: "Las cuentas las crea el administrador. Pídele que te dé de alta con tu correo.",
};

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
    recordar: [true],
  });
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.aviso.set(null);
    const { email, password, recordar } = this.form.getRawValue();
    try {
      await this.auth.login(email, password, recordar);
      await this.router.navigateByUrl(rutaInicio(this.auth.user()?.rol));
    } catch (err) {
      this.error.set(mensajeError(err, "Credenciales inválidas"));
    } finally {
      this.loading.set(false);
    }
  }

  avisar(acceso: AccesoPendiente): void {
    this.error.set(null);
    this.aviso.set(AVISOS[acceso]);
  }

  invalido(campo: "email" | "password"): boolean {
    const control = this.form.controls[campo];
    return control.invalid && control.touched;
  }
}
