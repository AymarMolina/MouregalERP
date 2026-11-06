import type {
  AjusteModo,
  EstadoRegla,
  InsumoCategoria,
  RolRecetaLinea,
  Talla,
  TipoCambio,
  UnidadBase,
} from "@erp/shared";

export interface Insumo {
  id: string;
  codigo: string;
  nombre: string;
  categoria: InsumoCategoria;
  unidadBase: UnidadBase;
  stockMinimo: string;
  stockActual: string;
  costoPromedio: string;
  esFlor: boolean;
  activo: boolean;
}

export interface ProductoTalla {
  id: string;
  productoId: string;
  talla: Talla;
  precioBase: string;
  activo: boolean;
  costo: string;
  margen: string;
}

export interface Producto {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  florPrincipalId: string;
  usaPapel: boolean;
  papelDefaultId: string | null;
  imagenUrl: string | null;
  activo: boolean;
  tallas: ProductoTalla[];
}

export interface RecetaLinea {
  id: string;
  productoTallaId: string;
  insumoId: string;
  cantidad: string;
  rol: RolRecetaLinea;
}

export interface ReglaCambio {
  id: string;
  tipo: TipoCambio;
  productoId: string | null;
  insumoOrigenId: string | null;
  insumoDestinoId: string | null;
  descripcion: string | null;
  ajusteModo: AjusteModo;
  ajusteMonto: string;
  estado: EstadoRegla;
  activo: boolean;
}

export interface Extra {
  id: string;
  nombre: string;
  insumoId: string;
  precio: string;
  fuerzaCarro: boolean;
  activo: boolean;
}

export interface Distrito {
  id: string;
  nombre: string;
  tarifaMoto: string;
  tarifaCarro: string;
  activo: boolean;
}

export interface CostoVehiculo {
  vehiculo: "moto" | "carro";
  costoPorViaje: string;
}
