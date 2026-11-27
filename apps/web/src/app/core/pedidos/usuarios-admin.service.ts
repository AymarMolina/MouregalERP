import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import type { RolUsuario } from "@erp/shared";
import { environment } from "../../../environments/environment";

export interface UsuarioAdmin {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  createdAt: string;
}

/** Administración de usuarios (solo admin). */
@Injectable({ providedIn: "root" })
export class UsuariosAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/usuarios`;

  todos(): Promise<UsuarioAdmin[]> {
    return firstValueFrom(this.http.get<UsuarioAdmin[]>(`${this.base}/todos`));
  }

  crear(input: { nombre: string; email: string; rol: RolUsuario }): Promise<{ usuario: UsuarioAdmin; password: string | null }> {
    return firstValueFrom(this.http.post<{ usuario: UsuarioAdmin; password: string | null }>(this.base, input));
  }

  editar(id: string, input: Partial<Pick<UsuarioAdmin, "nombre" | "rol" | "activo">>): Promise<UsuarioAdmin> {
    return firstValueFrom(this.http.patch<UsuarioAdmin>(`${this.base}/${id}`, input));
  }

  nuevaClave(id: string): Promise<{ usuario: UsuarioAdmin; password: string }> {
    return firstValueFrom(this.http.post<{ usuario: UsuarioAdmin; password: string }>(`${this.base}/${id}/clave`, {}));
  }
}
