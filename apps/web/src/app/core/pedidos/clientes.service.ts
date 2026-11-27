import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import type { EstadoPedido } from "@erp/shared";
import { environment } from "../../../environments/environment";

export interface ClienteLista {
  id: string;
  nombre: string;
  telefono: string | null;
  pedidos: number;
  gastado: number;
  debe: number;
  ultimo: string | null;
}

export interface FechaEspecial {
  id: string;
  clienteId: string;
  descripcion: string;
  dia: number;
  mes: number;
}

export interface FichaCliente {
  cliente: { id: string; nombre: string; telefono: string | null; email: string | null; createdAt: string };
  pedidos: number;
  gastado: number;
  debe: number;
  fechas: FechaEspecial[];
  direcciones: { direccion: string; distrito: string | null; veces: number }[];
  historial: { id: string; codigo: string; estado: EstadoPedido; fechaEntrega: string; total: string; totalPagado: string; resumen: string | null }[];
}

export interface FechaProxima {
  id: string;
  clienteId: string;
  cliente: string;
  telefono: string | null;
  descripcion: string;
  dia: number;
  mes: number;
  enDias: number;
}

@Injectable({ providedIn: "root" })
export class ClientesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/clientes`;

  list(q = ""): Promise<ClienteLista[]> {
    return firstValueFrom(this.http.get<ClienteLista[]>(this.base, { params: q ? { q } : {} }));
  }
  ficha(id: string): Promise<FichaCliente> {
    return firstValueFrom(this.http.get<FichaCliente>(`${this.base}/${id}`));
  }
  proximas(dias = 7): Promise<FechaProxima[]> {
    return firstValueFrom(this.http.get<FechaProxima[]>(`${this.base}/fechas-proximas`, { params: { dias } }));
  }
  agregarFecha(id: string, input: { descripcion: string; dia: number; mes: number }): Promise<FechaEspecial> {
    return firstValueFrom(this.http.post<FechaEspecial>(`${this.base}/${id}/fechas`, input));
  }
  quitarFecha(id: string, fechaId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}/fechas/${fechaId}`));
  }
}
