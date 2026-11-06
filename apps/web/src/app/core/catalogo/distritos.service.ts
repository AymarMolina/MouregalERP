import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import type { CostoVehiculoInput, DistritoInput } from "@erp/shared";
import { environment } from "../../../environments/environment";
import type { CostoVehiculo, Distrito } from "./catalogo.types";

@Injectable({ providedIn: "root" })
export class DistritosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/distritos`;

  list(): Promise<Distrito[]> {
    return firstValueFrom(this.http.get<Distrito[]>(this.base));
  }

  create(input: DistritoInput): Promise<Distrito> {
    return firstValueFrom(this.http.post<Distrito>(this.base, input));
  }

  update(id: string, input: Partial<DistritoInput>): Promise<Distrito> {
    return firstValueFrom(this.http.patch<Distrito>(`${this.base}/${id}`, input));
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }
}

@Injectable({ providedIn: "root" })
export class CostosVehiculoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/costos-vehiculo`;

  list(): Promise<CostoVehiculo[]> {
    return firstValueFrom(this.http.get<CostoVehiculo[]>(this.base));
  }

  update(input: CostoVehiculoInput): Promise<CostoVehiculo[]> {
    return firstValueFrom(this.http.put<CostoVehiculo[]>(this.base, input));
  }
}
