import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import type { ExtraInput } from "@erp/shared";
import { environment } from "../../../environments/environment";
import type { Extra } from "./catalogo.types";

@Injectable({ providedIn: "root" })
export class ExtrasService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/extras`;

  list(): Promise<Extra[]> {
    return firstValueFrom(this.http.get<Extra[]>(this.base));
  }

  create(input: ExtraInput): Promise<Extra> {
    return firstValueFrom(this.http.post<Extra>(this.base, input));
  }

  update(id: string, input: Partial<ExtraInput>): Promise<Extra> {
    return firstValueFrom(this.http.patch<Extra>(`${this.base}/${id}`, input));
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }
}
