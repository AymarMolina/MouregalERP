import { descargarExcel } from "./excel";
import { computed, signal } from "@angular/core";

export interface OpcionesTabla<T> {
  /** Identificador estable de cada fila (para la selección). */
  id: (fila: T) => string;
  /** Filas por página. */
  porPagina?: number;
  /** Columnas para "Exportar a Excel" (clave = encabezado de la columna). */
  csv?: (fila: T) => Record<string, string | number | null | undefined>;
  /** Nombre del archivo Excel, sin extensión ni fecha. */
  nombreCsv?: string;
}

/**
 * Estado de una tabla de datos: paginación y selección múltiple.
 * La fuente es una señal (o función que lee señales), así que la tabla se
 * recalcula sola al filtrar o al recargar. La selección sobrevive al cambio
 * de página y se limpia de ids que ya no existen en la fuente.
 */
export class Tabla<T> {
  readonly porPagina: number;
  readonly pagina = signal(1);
  private readonly marcados = signal<ReadonlySet<string>>(new Set());

  constructor(
    private readonly fuente: () => readonly T[],
    private readonly opciones: OpcionesTabla<T>,
  ) {
    this.porPagina = opciones.porPagina ?? 10;
  }

  readonly total = computed(() => this.fuente().length);
  readonly paginas = computed(() => Math.max(1, Math.ceil(this.total() / this.porPagina)));
  /** Página actual acotada (si un filtro reduce las filas, no queda en una página vacía). */
  readonly paginaActual = computed(() => Math.min(this.pagina(), this.paginas()));

  readonly filas = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.porPagina;
    return this.fuente().slice(inicio, inicio + this.porPagina);
  });

  /** Ids seleccionados que siguen existiendo en la fuente. */
  readonly seleccionados = computed(() => {
    const marcados = this.marcados();
    if (marcados.size === 0) return [] as T[];
    return this.fuente().filter((f) => marcados.has(this.opciones.id(f)));
  });
  readonly cantidadSeleccionada = computed(() => this.seleccionados().length);

  /** Estado del checkbox de la cabecera, sobre las filas de la página visible. */
  readonly todosMarcados = computed(() => {
    const filas = this.filas();
    const marcados = this.marcados();
    return filas.length > 0 && filas.every((f) => marcados.has(this.opciones.id(f)));
  });
  readonly algunosMarcados = computed(() => {
    const marcados = this.marcados();
    return !this.todosMarcados() && this.filas().some((f) => marcados.has(this.opciones.id(f)));
  });

  get exportable(): boolean {
    return !!this.opciones.csv;
  }

  marcado(fila: T): boolean {
    return this.marcados().has(this.opciones.id(fila));
  }

  alternar(fila: T): void {
    const id = this.opciones.id(fila);
    const nuevo = new Set(this.marcados());
    if (nuevo.has(id)) nuevo.delete(id);
    else nuevo.add(id);
    this.marcados.set(nuevo);
  }

  alternarPagina(): void {
    const nuevo = new Set(this.marcados());
    const ids = this.filas().map((f) => this.opciones.id(f));
    if (this.todosMarcados()) ids.forEach((id) => nuevo.delete(id));
    else ids.forEach((id) => nuevo.add(id));
    this.marcados.set(nuevo);
  }

  limpiar(): void {
    this.marcados.set(new Set());
  }

  anterior(): void {
    this.pagina.set(Math.max(1, this.paginaActual() - 1));
  }

  siguiente(): void {
    this.pagina.set(Math.min(this.paginas(), this.paginaActual() + 1));
  }

  /** Descarga a Excel las filas seleccionadas o, si no hay selección, todas las filtradas. */
  exportarExcel(): void {
    const mapear = this.opciones.csv;
    if (!mapear) return;
    const filas = (this.cantidadSeleccionada() ? this.seleccionados() : this.fuente()).map(mapear);
    descargarExcel(this.opciones.nombreCsv ?? "export", filas);
  }
}
