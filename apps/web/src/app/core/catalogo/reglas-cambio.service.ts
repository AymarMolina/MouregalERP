import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import type { ReglaCambioInput } from "@erp/shared";
import { environment } from "../../../environments/environment";
import type { ReglaCambio } from "./catalogo.types";

@Injectable({ providedIn: "root" })
export class ReglasCambioService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/reglas-cambio`;

  list(): Promise<ReglaCambio[]> {
    return firstValueFrom(this.http.get<ReglaCambio[]>(this.base));
  }

  create(input: ReglaCambioInput): Promise<ReglaCambio> {
    return firstValueFrom(this.http.post<ReglaCambio>(this.base, input));
  }

  update(id: string, input: Partial<ReglaCambioInput>): Promise<ReglaCambio> {
    return firstValueFrom(this.http.patch<ReglaCambio>(`${this.base}/${id}`, input));
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }
}
