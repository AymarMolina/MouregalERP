import type { Canal, EstadoConsulta, EstadoPedido, Talla, Vehiculo } from "@erp/shared";

export interface OpcionCotizacion {
  insumoId: string;
  nombre: string;
  ajusteModo: "fijo" | "por_unidad" | null;
  ajuste: number;
  estado: "aprobado" | "consultar";
  disponible: boolean;
  motivo?: string;
}

export interface OpcionExtra {
  id: string;
  insumoId: string;
  nombre: string;
  precio: number;
  disponible: boolean;
  motivo?: string;
}

export interface AjusteAplicado {
  descripcion: string;
  ajuste: number;
}

export interface ResultadoCotizacion {
  productoId: string;
  talla: Talla;
  cantidad: number;
  florId: string;
  papelId: string | null;
  extraIds: string[];
  precioUnitario: number;
  subtotal: number;
  ajustes: AjusteAplicado[];
  vehiculo: Vehiculo;
  costoEnvio: number;
  total: number;
  opciones: { flores: OpcionCotizacion[]; papeles: OpcionCotizacion[]; extras: OpcionExtra[] };
}

export interface Pedido {
  id: string;
  numero: number;
  canal: Canal;
  clienteId: string;
  estado: EstadoPedido;
  fechaEntrega: string;
  horaEntrega: string;
  distritoId: string;
  direccion: string;
  referencia: string | null;
  telefonoReceptor: string;
  nombreReceptor: string;
  dedicatoria: string | null;
  vehiculo: Vehiculo;
  subtotalProductos: string;
  costoEnvio: string;
  total: string;
  totalPagado: string;
  encargadaId: string | null;
  repartidorId: string | null;
  createdAt: string;
}

export interface PedidoItem {
  id: string;
  pedidoId: string;
  productoTallaId: string;
  cantidad: number;
  florId: string;
  papelId: string | null;
  precioUnitario: string;
  subtotal: string;
}

export interface PedidoDetalle extends Pedido {
  items: PedidoItem[];
}

export interface HistorialEstado {
  id: string;
  pedidoId: string;
  estadoAnterior: EstadoPedido | null;
  estadoNuevo: EstadoPedido;
  nota: string | null;
  createdAt: string;
}

export interface Consulta {
  id: string;
  pedidoId: string;
  descripcion: string;
  estado: EstadoConsulta;
  respuesta: string | null;
  ajustePrecio: string | null;
  createdAt: string;
}

export interface StockBajoItem {
  id: string;
  codigo: string;
  nombre: string;
  stockActual: string;
  stockMinimo: string;
}

export interface DashboardHoy {
  fecha: string;
  kpis: {
    pedidosHoy: number;
    totalHoy: number;
    conteoPorEstado: Record<string, number>;
    consultasAbiertas: number;
    stockBajo: number;
  };
  pedidosPorHora: Pedido[];
  consultasAbiertas: Consulta[];
  stockBajo: StockBajoItem[];
}
