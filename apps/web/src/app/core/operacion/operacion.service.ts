import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import type {
  EstadoOc,
  OrdenCompraInput,
  OrdenCompraUpdate,
  PagoManualInput,
  ProveedorInput,
  RecepcionInput,
} from "@erp/shared";
import { environment } from "../../../environments/environment";
import type { PedidoDetalle } from "../pedidos/pedidos.types";
import type {
  CompraSugerida,
  OrdenCompraDetalle,
  OrdenCompraResumen,
  Pago,
  PedidoConSaldo,
  Proveedor,
  Rango,
  ReporteCobros,
  ReporteEnvios,
  ReporteMargen,
  ReporteMasVendidos,
  ReporteMerma,
  TableroDelivery,
} from "./operacion.types";

const api = environment.apiUrl;

function query(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

@Injectable({ providedIn: "root" })
export class PagosApi {
  private readonly http = inject(HttpClient);

  resumen(filtros: { saldo?: boolean; fecha?: string }): Promise<PedidoConSaldo[]> {
    return firstValueFrom(
      this.http.get<PedidoConSaldo[]>(`${api}/pagos${query({ saldo: filtros.saldo ? 1 : undefined, fecha: filtros.fecha })}`),
    );
  }

  delPedido(pedidoId: string): Promise<Pago[]> {
    return firstValueFrom(this.http.get<Pago[]>(`${api}/pedidos/${pedidoId}/pagos`));
  }

  registrar(pedidoId: string, input: PagoManualInput): Promise<Pago> {
    return firstValueFrom(this.http.post<Pago>(`${api}/pedidos/${pedidoId}/pagos`, input));
  }

  linkSaldo(pedidoId: string): Promise<Pago> {
    return firstValueFrom(this.http.post<Pago>(`${api}/pedidos/${pedidoId}/pagos/link-saldo`, {}));
  }

  confirmar(pagoId: string, referenciaExterna?: string): Promise<Pago> {
    return firstValueFrom(this.http.post<Pago>(`${api}/pagos/${pagoId}/confirmar`, { referenciaExterna }));
  }

  anular(pagoId: string): Promise<Pago> {
    return firstValueFrom(this.http.post<Pago>(`${api}/pagos/${pagoId}/anular`, {}));
  }
}

@Injectable({ providedIn: "root" })
export class DeliveryApi {
  private readonly http = inject(HttpClient);

  tablero(fecha?: string): Promise<TableroDelivery> {
    return firstValueFrom(this.http.get<TableroDelivery>(`${api}/delivery${query({ fecha })}`));
  }

  despachar(pedidoId: string, repartidorId?: string): Promise<PedidoDetalle> {
    return firstValueFrom(this.http.post<PedidoDetalle>(`${api}/pedidos/${pedidoId}/despachar`, { repartidorId }));
  }

  entregar(pedidoId: string, nota?: string): Promise<PedidoDetalle> {
    return firstValueFrom(
      this.http.post<PedidoDetalle>(`${api}/pedidos/${pedidoId}/transicion`, { a: "entregado", nota }),
    );
  }
}

@Injectable({ providedIn: "root" })
export class ComprasApi {
  private readonly http = inject(HttpClient);

  proveedores(): Promise<Proveedor[]> {
    return firstValueFrom(this.http.get<Proveedor[]>(`${api}/proveedores`));
  }

  crearProveedor(input: ProveedorInput): Promise<Proveedor> {
    return firstValueFrom(this.http.post<Proveedor>(`${api}/proveedores`, input));
  }

  actualizarProveedor(id: string, input: Partial<ProveedorInput>): Promise<Proveedor> {
    return firstValueFrom(this.http.patch<Proveedor>(`${api}/proveedores/${id}`, input));
  }

  sugeridas(dias: number): Promise<CompraSugerida[]> {
    return firstValueFrom(this.http.get<CompraSugerida[]>(`${api}/compras/sugeridas${query({ dias })}`));
  }

  ordenes(estado?: EstadoOc): Promise<OrdenCompraResumen[]> {
    return firstValueFrom(this.http.get<OrdenCompraResumen[]>(`${api}/ordenes-compra${query({ estado })}`));
  }

  orden(id: string): Promise<OrdenCompraDetalle> {
    return firstValueFrom(this.http.get<OrdenCompraDetalle>(`${api}/ordenes-compra/${id}`));
  }

  crearOrden(input: OrdenCompraInput): Promise<OrdenCompraDetalle> {
    return firstValueFrom(this.http.post<OrdenCompraDetalle>(`${api}/ordenes-compra`, input));
  }

  actualizarOrden(id: string, input: OrdenCompraUpdate): Promise<OrdenCompraDetalle> {
    return firstValueFrom(this.http.patch<OrdenCompraDetalle>(`${api}/ordenes-compra/${id}`, input));
  }

  recepcion(id: string, input: RecepcionInput): Promise<OrdenCompraDetalle> {
    return firstValueFrom(this.http.post<OrdenCompraDetalle>(`${api}/ordenes-compra/${id}/recepcion`, input));
  }
}

@Injectable({ providedIn: "root" })
export class ReportesApi {
  private readonly http = inject(HttpClient);

  margen(r: Partial<Rango>): Promise<ReporteMargen> {
    return firstValueFrom(this.http.get<ReporteMargen>(`${api}/reportes/margen${query(r)}`));
  }
  merma(r: Partial<Rango>): Promise<ReporteMerma> {
    return firstValueFrom(this.http.get<ReporteMerma>(`${api}/reportes/merma${query(r)}`));
  }
  masVendidos(r: Partial<Rango>): Promise<ReporteMasVendidos> {
    return firstValueFrom(this.http.get<ReporteMasVendidos>(`${api}/reportes/mas-vendidos${query(r)}`));
  }
  envios(r: Partial<Rango>): Promise<ReporteEnvios> {
    return firstValueFrom(this.http.get<ReporteEnvios>(`${api}/reportes/envios${query(r)}`));
  }
  cobros(r: Partial<Rango>): Promise<ReporteCobros> {
    return firstValueFrom(this.http.get<ReporteCobros>(`${api}/reportes/cobros${query(r)}`));
  }
}
