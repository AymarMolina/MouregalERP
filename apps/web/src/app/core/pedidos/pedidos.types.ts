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
  /** La selección completa cabe en el stock disponible. */
  disponible: boolean;
  faltantes: { insumoId: string; nombre: string; necesario: number; disponible: number }[];
  /** Al crear el pedido se abrirá una consulta a Producción. */
  requiereConsulta: boolean;
  consultas: string[];
  opciones: {
    tallas: OpcionTalla[];
    flores: OpcionCotizacion[];
    papeles: OpcionCotizacion[];
    extras: OpcionExtra[];
  };
}

/** Cotización del pedido completo (POST /cotizaciones/pedido). */
export interface ResultadoCotizacionPedido {
  items: {
    productoId: string;
    producto: string;
    talla: Talla;
    cantidad: number;
    flor: string;
    papel: string | null;
    extras: string[];
    precioUnitario: number;
    subtotal: number;
    ajustes: AjusteAplicado[];
    vehiculo: Vehiculo;
    consultas: string[];
  }[];
  subtotalProductos: number;
  vehiculo: Vehiculo;
  costoEnvio: number;
  total: number;
  disponible: boolean;
  faltantes: { insumoId: string; nombre: string; necesario: number; disponible: number }[];
  requiereConsulta: boolean;
}

export interface OpcionTalla {
  talla: Talla;
  precioBase: number;
  disponible: boolean;
  motivo?: string;
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
  producto: string;
  talla: Talla;
  flor: string | null;
  papel: string | null;
  extras: string[];
  cambios: { descripcion: string; ajuste: string }[];
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
  unidadBase: string;
  stockActual: string;
  stockMinimo: string;
}

export interface PedidoDelDia {
  id: string;
  numero: number;
  estado: EstadoPedido;
  canal: Canal;
  fechaEntrega: string;
  horaEntrega: string;
  nombreReceptor: string;
  cliente: string;
  distrito: string;
  vehiculo: Vehiculo;
  total: string;
  totalPagado: string;
}

export interface DashboardHoy {
  fecha: string;
  /** Día contra el que se comparan las variaciones (mismo día de la semana pasada). */
  comparadoCon: string;
  kpis: {
    pedidosHoy: number;
    pedidosVariacion: number | null;
    ventasHoy: number;
    ventasVariacion: number | null;
    ticketPromedio: number;
    ticketVariacion: number | null;
    porCobrar: number;
    pedidosConSaldo: number;
    conteoPorEstado: Partial<Record<string, number>>;
    consultasAbiertas: number;
    stockBajo: number;
  };
  serieVentas: { fecha: string; ventas: number; pedidos: number }[];
  pedidosPorHora: { hora: number; pedidos: number }[];
  pedidos: PedidoDelDia[];
  consultasAbiertas: { id: string; pedidoId: string; numero: number; descripcion: string; createdAt: string }[];
  stockBajo: StockBajoItem[];
}
