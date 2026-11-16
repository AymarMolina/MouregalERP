import type { EstadoOc, EstadoPago, EstadoPedido, MetodoPago, TipoPago, Talla, Vehiculo } from "@erp/shared";

// ---------- Pagos ----------

export interface Pago {
  id: string;
  pedidoId: string;
  tipo: TipoPago;
  metodo: MetodoPago;
  monto: string;
  estado: EstadoPago;
  linkUrl: string | null;
  referenciaExterna: string | null;
  pagadoAt: string | null;
  createdAt: string;
}

export interface PedidoConSaldo {
  id: string;
  numero: number;
  estado: EstadoPedido;
  canal: string;
  fechaEntrega: string;
  horaEntrega: string;
  total: string;
  totalPagado: string;
  saldo: number;
  clienteNombre: string;
  clienteTelefono: string | null;
  distrito: string;
  pagos: Pago[];
}

// ---------- Delivery ----------

export interface PedidoDelivery {
  id: string;
  numero: number;
  estado: EstadoPedido;
  fechaEntrega: string;
  horaEntrega: string;
  direccion: string;
  referencia: string | null;
  nombreReceptor: string;
  telefonoReceptor: string;
  vehiculo: Vehiculo;
  total: string;
  totalPagado: string;
  saldo: number;
  distrito: string;
  repartidorId: string | null;
  repartidor: string | null;
  linkSaldo: { url: string | null; estado: EstadoPago } | null;
}

export interface TableroDelivery {
  fecha: string;
  permitirEntregaConSaldo: boolean;
  repartidores: { id: string; nombre: string }[];
  pedidos: PedidoDelivery[];
}

// ---------- Compras ----------

export interface Proveedor {
  id: string;
  nombre: string;
  ruc: string | null;
  telefono: string | null;
  activo: boolean;
}

export interface CompraSugerida {
  insumoId: string;
  codigo: string;
  nombre: string;
  unidadBase: string;
  stockActual: number;
  stockMinimo: number;
  costoPromedio: number;
  reservado: number;
  demanda: number;
  sugerido: number;
  pendienteEnOrdenes: number;
  aComprar: number;
}

export interface OrdenCompraResumen {
  id: string;
  numero: number;
  estado: EstadoOc;
  fecha: string;
  total: string;
  nota: string | null;
  proveedorId: string;
  proveedor: string;
  lineas: number;
}

export interface OrdenCompraLinea {
  id: string;
  insumoId: string;
  codigo: string;
  nombre: string;
  unidadBase: string;
  paquetes: string;
  unidadesPorPaquete: string;
  cantidadBase: string;
  costoTotal: string;
  costoUnitario: string;
  cantidadRecibida: string;
}

export interface OrdenCompraDetalle extends Omit<OrdenCompraResumen, "lineas"> {
  lineas: OrdenCompraLinea[];
}

// ---------- Reportes ----------

export interface Rango {
  desde: string;
  hasta: string;
}

export interface ReporteMargen {
  rango: Rango;
  filas: {
    producto: string;
    talla: Talla;
    unidades: number;
    ingresos: number;
    costo: number;
    margen: number;
    margenPct: number;
  }[];
  totales: { ingresos: number; costo: number; margen: number; margenPct: number };
}

export interface ReporteMerma {
  rango: Rango;
  filas: {
    insumoId: string;
    codigo: string;
    nombre: string;
    unidadBase: string;
    cantidadProduccion: number;
    valorProduccion: number;
    cantidadCancelacion: number;
    valorCancelacion: number;
    valorTotal: number;
  }[];
  totales: { valorProduccion: number; valorCancelacion: number; valorTotal: number };
}

export interface ReporteMasVendidos {
  rango: Rango;
  filas: { producto: string; talla: Talla; unidades: number; pedidos: number; ingresos: number }[];
}

export interface ReporteEnvios {
  rango: Rango;
  filas: { distrito: string; vehiculo: Vehiculo; viajes: number; cobrado: number; costo: number; diferencia: number }[];
  totales: { viajes: number; cobrado: number; costo: number; diferencia: number };
}

export interface ReporteCobros {
  rango: Rango;
  filas: {
    pagoId: string;
    pagadoAt: string | null;
    tipo: string;
    metodo: string;
    monto: number;
    pedidoId: string;
    numero: number;
    estadoPedido: EstadoPedido;
    cliente: string;
  }[];
  porMetodo: { metodo: string; cobros: number; monto: number }[];
  totales: { cobros: number; monto: number };
}
