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

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password }),
    );
    this.accessToken = res.accessToken;
    this.user.set(res.user);
    localStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
  }

  /** Restaura la sesión al arrancar la app a partir del refresh token guardado. */
  async refresh(): Promise<boolean> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return false;

    try {
      const tokens = await firstValueFrom(
        this.http.post<RefreshResponse>(`${environment.apiUrl}/auth/refresh`, { refreshToken }),
      );
      this.accessToken = tokens.accessToken;
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);

      const user = await firstValueFrom(this.http.get<AuthUser>(`${environment.apiUrl}/auth/me`));
      this.user.set(user);
      return true;
    } catch {
      this.clearSession();
      return false;
    }
  }

  logout(): void {
    this.clearSession();
    void this.router.navigateByUrl("/login");
  }

  private clearSession(): void {
    this.accessToken = null;
    this.user.set(null);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}
