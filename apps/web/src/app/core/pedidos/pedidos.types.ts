import type { Canal, EstadoConsulta, EstadoPedido, Talla, TipoEntrega, Vehiculo } from "@erp/shared";

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
  /** Solo en listas (GET /pedidos): arreglos del pedido en una línea, p. ej. "Ramo Clásico de Rosas S". */
  resumen?: string | null;
  id: string;
  numero: number;
  codigo: string;
  canal: Canal;
  clienteId: string;
  estado: EstadoPedido;
  fechaEntrega: string;
  horaEntrega: string;
  /** recojo: sin distrito, dirección, receptor ni vehículo. */
  tipoEntrega: TipoEntrega;
  distritoId: string | null;
  direccion: string | null;
  referencia: string | null;
  ubicacionUrl: string | null;
  ubicacionLat: number | null;
  ubicacionLng: number | null;
  telefonoReceptor: string | null;
  nombreReceptor: string | null;
  dedicatoria: string | null;
  vehiculo: Vehiculo | null;
  subtotalProductos: string;
  costoEnvio: string;
  descuento: string;
  motivoDescuento: string | null;
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
  codigo: string;
  estado: EstadoPedido;
  canal: Canal;
  fechaEntrega: string;
  horaEntrega: string;
  nombreReceptor: string | null;
  cliente: string;
  distrito: string | null;
  vehiculo: Vehiculo | null;
  tipoEntrega: TipoEntrega;
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
  consultasAbiertas: { id: string; pedidoId: string; numero: number; codigo: string; descripcion: string; createdAt: string }[];
  stockBajo: StockBajoItem[];
}

/** Fila de "Todos los pedidos" (GET /pedidos): el pedido con cliente, distrito, vendedora y resumen. */
export interface PedidoLista {
  id: string;
  numero: number;
  codigo: string;
  canal: Canal;
  estado: EstadoPedido;
  fechaEntrega: string;
  horaEntrega: string;
  tipoEntrega: TipoEntrega;
  nombreReceptor: string | null;
  total: string;
  totalPagado: string;
  createdAt: string;
  cliente: string | null;
  telefonoCliente: string | null;
  distrito: string | null;
  vendedora: string | null;
  resumen: string | null;
}
