import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { environment } from "../../../environments/environment";

export interface CajaFila {
  id: string;
  usuarioId: string;
  fondo: string;
  abiertaAt: string;
  cerradaAt: string | null;
  esperado: string | null;
  contado: string | null;
  nota: string | null;
}

export interface CajaAbierta {
  caja: CajaFila;
  porMetodo: Record<string, number>;
  totalCobrado: number;
  ingresos: number;
  egresos: number;
  efectivoEsperado: number;
  cobros: { id: string; metodo: string; monto: string; pagadoAt: string; codigo: string; referencia: string | null }[];
  movimientos: { id: string; tipo: "egreso" | "ingreso"; monto: string; motivo: string; createdAt: string }[];
}

export interface EstadoCaja {
  abierta: CajaAbierta | null;
  ultima: CajaFila | null;
}

/** Caja de quien está conectado. */
@Injectable({ providedIn: "root" })
export class CajaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/caja`;

  actual(): Promise<EstadoCaja> {
    return firstValueFrom(this.http.get<EstadoCaja>(this.base));
  }
  abrir(fondo: number): Promise<EstadoCaja> {
    return firstValueFrom(this.http.post<EstadoCaja>(`${this.base}/abrir`, { fondo }));
  }
  movimiento(tipo: "egreso" | "ingreso", monto: number, motivo: string): Promise<EstadoCaja> {
    return firstValueFrom(this.http.post<EstadoCaja>(`${this.base}/movimientos`, { tipo, monto, motivo }));
  }
  cerrar(contado: number, nota?: string): Promise<{ cerrada: CajaFila; diferencia: number }> {
    return firstValueFrom(this.http.post<{ cerrada: CajaFila; diferencia: number }>(`${this.base}/cerrar`, { contado, nota }));
  }
}
