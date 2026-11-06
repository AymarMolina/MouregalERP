import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import type { CotizacionInput, PedidoInput } from "@erp/shared";
import { environment } from "../../../environments/environment";
import type {
  Consulta,
  DashboardHoy,
  HistorialEstado,
  PedidoDetalle,
  ResultadoCotizacion,
} from "./pedidos.types";

@Injectable({ providedIn: "root" })
export class CotizacionesService {
  private readonly http = inject(HttpClient);

  cotizar(input: CotizacionInput): Promise<ResultadoCotizacion> {
    return firstValueFrom(this.http.post<ResultadoCotizacion>(`${environment.apiUrl}/cotizaciones`, input));
  }
}

@Injectable({ providedIn: "root" })
export class PedidosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/pedidos`;

  list(filtros: { fecha?: string; estado?: string; canal?: string; q?: string } = {}): Promise<PedidoDetalle[]> {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) if (v) params.set(k, v);
    const qs = params.toString();
    return firstValueFrom(this.http.get<PedidoDetalle[]>(`${this.base}${qs ? `?${qs}` : ""}`));
  }

  get(id: string): Promise<PedidoDetalle> {
    return firstValueFrom(this.http.get<PedidoDetalle>(`${this.base}/${id}`));
  }

  historial(id: string): Promise<HistorialEstado[]> {
    return firstValueFrom(this.http.get<HistorialEstado[]>(`${this.base}/${id}/historial`));
  }

  crear(input: PedidoInput): Promise<PedidoDetalle> {
    return firstValueFrom(this.http.post<PedidoDetalle>(this.base, input));
  }
}

@Injectable({ providedIn: "root" })
export class ConsultasService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/consultas`;

  list(estado?: string): Promise<Consulta[]> {
    const qs = estado ? `?estado=${estado}` : "";
    return firstValueFrom(this.http.get<Consulta[]>(`${this.base}${qs}`));
  }

  resolver(id: string, input: { estado: "aprobada" | "rechazada"; respuesta: string; ajustePrecio?: number }) {
    return firstValueFrom(this.http.post<Consulta>(`${this.base}/${id}/resolver`, input));
  }
}

@Injectable({ providedIn: "root" })
export class DashboardService {
  private readonly http = inject(HttpClient);

  hoy(): Promise<DashboardHoy> {
    return firstValueFrom(this.http.get<DashboardHoy>(`${environment.apiUrl}/dashboard/hoy`));
  }
}
