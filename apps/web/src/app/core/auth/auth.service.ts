import { HttpClient } from "@angular/common/http";
import { Injectable, signal } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import type { AuthUser } from "@erp/shared";
import { environment } from "../../../environments/environment";
import { borrarDeUsuario } from "../offline/cache-local";
import { esFallaDeRed } from "../offline/conexion.service";

interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

const REFRESH_TOKEN_KEY = "erp_refresh_token";
/** Copia del usuario, para poder abrir la app sin conexión. Vive junto al refresh token. */
const USUARIO_KEY = "erp_usuario";

@Injectable({ providedIn: "root" })
export class AuthService {
  private accessToken: string | null = null;
  readonly user = signal<AuthUser | null>(null);
  /** true si la última renovación del token falló por red y no porque la sesión venciera. */
  renovacionSinRed = false;

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
  ) {}

  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * `recordar`: true guarda el refresh token en localStorage (sobrevive al
   * cerrar el navegador); false lo guarda en sessionStorage (se pierde al cerrarlo).
   */
  async login(email: string, password: string, recordar = true): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password }),
    );
    this.accessToken = res.accessToken;
    this.user.set(res.user);
    this.borrarRefreshToken();
    const storage = recordar ? localStorage : sessionStorage;
    storage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
    storage.setItem(USUARIO_KEY, JSON.stringify(res.user));
  }

  private leerUsuarioGuardado(): AuthUser | null {
    for (const storage of [sessionStorage, localStorage]) {
      const raw = storage.getItem(USUARIO_KEY);
      if (!raw) continue;
      try {
        return JSON.parse(raw) as AuthUser;
      } catch {
        return null;
      }
    }
    return null;
  }

  /** El refresh token vive en uno de los dos almacenamientos según "Recuérdame". */
  private leerRefreshToken(): { token: string; storage: Storage } | null {
    for (const storage of [sessionStorage, localStorage]) {
      const token = storage.getItem(REFRESH_TOKEN_KEY);
      if (token) return { token, storage };
    }
    return null;
  }

  private borrarRefreshToken(): void {
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem(REFRESH_TOKEN_KEY);
      storage.removeItem(USUARIO_KEY);
    }
  }

  /**
   * Restaura la sesión al arrancar la app a partir del refresh token guardado.
   * Sin conexión, entra con el usuario guardado (modo solo lectura): la sesión
   * se valida con el servidor en cuanto vuelva el internet.
   */
  async refresh(): Promise<boolean> {
    const token = await this.renovarAccessToken();
    if (!token) {
      const guardado = this.renovacionSinRed ? this.leerUsuarioGuardado() : null;
      if (guardado) this.user.set(guardado);
      return !!guardado;
    }

    try {
      const user = await firstValueFrom(this.http.get<AuthUser>(`${environment.apiUrl}/auth/me`));
      this.user.set(user);
      this.leerRefreshToken()?.storage.setItem(USUARIO_KEY, JSON.stringify(user));
      return true;
    } catch (err) {
      const guardado = esFallaDeRed(err) ? this.leerUsuarioGuardado() : null;
      if (guardado) {
        this.user.set(guardado);
        return true;
      }
      this.clearSession();
      return false;
    }
  }

  /**
   * Pide un access token nuevo con el refresh token. Si varias peticiones
   * reciben 401 a la vez, comparten una sola renovación en curso.
   * Devuelve null (y cierra la sesión) si no se pudo renovar.
   */
  renovarAccessToken(): Promise<string | null> {
    this.renovacionEnCurso ??= this.ejecutarRenovacion().finally(() => {
      this.renovacionEnCurso = null;
    });
    return this.renovacionEnCurso;
  }

  private renovacionEnCurso: Promise<string | null> | null = null;

  private async ejecutarRenovacion(): Promise<string | null> {
    this.renovacionSinRed = false;
    const guardado = this.leerRefreshToken();
    if (!guardado) return null;
    try {
      const tokens = await firstValueFrom(
        this.http.post<RefreshResponse>(`${environment.apiUrl}/auth/refresh`, {
          refreshToken: guardado.token,
        }),
      );
      this.accessToken = tokens.accessToken;
      guardado.storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
      return tokens.accessToken;
    } catch (err) {
      // Sin internet la sesión no venció: se conserva para renovarla al volver.
      if (esFallaDeRed(err)) {
        this.renovacionSinRed = true;
        return null;
      }
      this.clearSession();
      return null;
    }
  }

  /** Cierra la sesión aquí y revoca los refresh tokens en el servidor (best effort). */
  logout(): void {
    if (this.accessToken) {
      this.http.post(`${environment.apiUrl}/auth/logout`, {}).subscribe({ error: () => undefined });
    }
    const id = this.user()?.id;
    if (id) void borrarDeUsuario(id);
    this.clearSession();
    void this.router.navigateByUrl("/login");
  }

  private clearSession(): void {
    this.accessToken = null;
    this.user.set(null);
    this.borrarRefreshToken();
  }
}
