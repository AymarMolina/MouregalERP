import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import type { AjusteInventarioInput, AperturaInput, InsumoInput } from "@erp/shared";
import { environment } from "../../../environments/environment";
import type { Insumo } from "./catalogo.types";

export interface KardexMovimiento {
  id: string;
  insumoId: string;
  fecha: string;
  tipo: string;
  entrada: string;
  salida: string;
  costoUnitario: string;
  saldoResultante: string;
  nota: string | null;
}

@Injectable({ providedIn: "root" })
export class InsumosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/insumos`;

  list(): Promise<Insumo[]> {
    return firstValueFrom(this.http.get<Insumo[]>(this.base));
  }

  create(input: InsumoInput): Promise<Insumo> {
    return firstValueFrom(this.http.post<Insumo>(this.base, input));
  }

  update(id: string, input: Partial<InsumoInput>): Promise<Insumo> {
    return firstValueFrom(this.http.patch<Insumo>(`${this.base}/${id}`, input));
  }

  cargarApertura(input: AperturaInput): Promise<{ cargados: number }> {
    return firstValueFrom(
      this.http.post<{ cargados: number }>(`${environment.apiUrl}/inventario/apertura`, input),
    );
  }

  kardex(id: string): Promise<KardexMovimiento[]> {
    return firstValueFrom(this.http.get<KardexMovimiento[]>(`${this.base}/${id}/kardex`));
  }

  ajustar(input: AjusteInventarioInput): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${environment.apiUrl}/inventario/ajustes`, input));
  }
}
