import { HttpClient } from "@angular/common/http";
import { Injectable, signal } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import type { AuthUser } from "@erp/shared";
import { environment } from "../../../environments/environment";

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

@Injectable({ providedIn: "root" })
export class AuthService {
  private accessToken: string | null = null;
  readonly user = signal<AuthUser | null>(null);

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
    (recordar ? localStorage : sessionStorage).setItem(REFRESH_TOKEN_KEY, res.refreshToken);
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
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  /** Restaura la sesión al arrancar la app a partir del refresh token guardado. */
  async refresh(): Promise<boolean> {
    const token = await this.renovarAccessToken();
    if (!token) return false;

    try {
      const user = await firstValueFrom(this.http.get<AuthUser>(`${environment.apiUrl}/auth/me`));
      this.user.set(user);
      return true;
    } catch {
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
    } catch {
      this.clearSession();
      return null;
    }
  }

  /** Cierra la sesión aquí y revoca los refresh tokens en el servidor (best effort). */
  logout(): void {
    if (this.accessToken) {
      this.http.post(`${environment.apiUrl}/auth/logout`, {}).subscribe({ error: () => undefined });
    }
    this.clearSession();
    void this.router.navigateByUrl("/login");
  }

  private clearSession(): void {
    this.accessToken = null;
    this.user.set(null);
    this.borrarRefreshToken();
  }
}
