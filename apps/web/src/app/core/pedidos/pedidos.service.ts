import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import type { CotizacionInput, CotizacionPedidoInput, PedidoInput } from "@erp/shared";
import { environment } from "../../../environments/environment";
import type {
  Consulta,
  DashboardHoy,
  HistorialEstado,
  PedidoDetalle,
  ResultadoCotizacion,
  ResultadoCotizacionPedido,
} from "./pedidos.types";

@Injectable({ providedIn: "root" })
export class CotizacionesService {
  private readonly http = inject(HttpClient);

  cotizar(input: CotizacionInput): Promise<ResultadoCotizacion> {
    return firstValueFrom(this.http.post<ResultadoCotizacion>(`${environment.apiUrl}/cotizaciones`, input));
  }

  cotizarPedido(input: CotizacionPedidoInput): Promise<ResultadoCotizacionPedido> {
    return firstValueFrom(
      this.http.post<ResultadoCotizacionPedido>(`${environment.apiUrl}/cotizaciones/pedido`, input),
    );
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

  asignar(id: string, input: { encargadaId?: string | null; repartidorId?: string | null }): Promise<PedidoDetalle> {
    return firstValueFrom(this.http.patch<PedidoDetalle>(`${this.base}/${id}/asignar`, input));
  }

  transicion(id: string, a: string, nota?: string): Promise<PedidoDetalle> {
    return firstValueFrom(this.http.post<PedidoDetalle>(`${this.base}/${id}/transicion`, { a, nota }));
  }

  confirmarConsumo(id: string, lineas: { insumoId: string; cantidadUsada: number }[]): Promise<PedidoDetalle> {
    return firstValueFrom(this.http.post<PedidoDetalle>(`${this.base}/${id}/consumo`, { lineas }));
  }

  recetaEfectiva(id: string): Promise<{ insumoId: string; nombre: string; unidadBase: string; cantidad: number }[]> {
    return firstValueFrom(
      this.http.get<{ insumoId: string; nombre: string; unidadBase: string; cantidad: number }[]>(`${this.base}/${id}/receta-efectiva`),
    );
  }
}

export interface Usuario {
  id: string;
  nombre: string;
  rol: string;
  activo: boolean;
}

@Injectable({ providedIn: "root" })
export class UsuariosService {
  private readonly http = inject(HttpClient);

  list(rol?: string): Promise<Usuario[]> {
    const qs = rol ? `?rol=${rol}` : "";
    return firstValueFrom(this.http.get<Usuario[]>(`${environment.apiUrl}/usuarios${qs}`));
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
