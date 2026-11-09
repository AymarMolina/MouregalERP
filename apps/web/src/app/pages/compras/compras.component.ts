import { descargarExcel } from "../../shared/tabla/excel";
import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { IconComponent } from "../../shared/icon/icon.component";
import { RowMenuComponent } from "../../shared/tabla/row-menu.component";
import { Tabla } from "../../shared/tabla/tabla";
import { TABLA_CONTROLES } from "../../shared/tabla/tabla-controles.component";
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import type { EstadoOc } from "@erp/shared";
import { mensajeError } from "../../core/http/errores";
import { ComprasApi } from "../../core/operacion/operacion.service";
import type {
  CompraSugerida,
  OrdenCompraDetalle,
  OrdenCompraResumen,
  Proveedor,
} from "../../core/operacion/operacion.types";
import { CLASE_ESTADO_OC, cantidad, soles } from "../../core/util/formato";

type Pestana = "sugeridas" | "ordenes" | "proveedores";

/** Fila editable de la lista sugerida. */
interface FilaCompra {
  sugerida: CompraSugerida;
  marcada: boolean;
  paquetes: number;
  unidadesPorPaquete: number;
  costoTotal: number;
}

/** Fila editable de una recepción. */
interface FilaRecepcion {
  lineaId: string;
  nombre: string;
  unidadBase: string;
  pendiente: number;
  marcada: boolean;
  paquetes: number;
  unidadesPorPaquete: number;
  costoTotal: number;
}

const ETIQUETA_OC: Record<EstadoOc, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  recibida_parcial: "Recibida parcial",
  recibida: "Recibida",
  anulada: "Anulada",
};

@Component({
  selector: "app-compras",
  imports: [FormsModule, ReactiveFormsModule, IconComponent, RowMenuComponent, ...TABLA_CONTROLES],
  templateUrl: "./compras.component.html",
})
export class ComprasComponent implements OnInit {
  private readonly api = inject(ComprasApi);
  private readonly fb = inject(FormBuilder);

  readonly soles = soles;
  readonly cantidad = cantidad;
  readonly claseOc = CLASE_ESTADO_OC;
  readonly etiquetaOc = ETIQUETA_OC;
  readonly estadosOc = Object.keys(ETIQUETA_OC) as EstadoOc[];

  readonly pestana = signal<Pestana>("sugeridas");

  /** Lista sugerida visible en Excel (mismo orden y filtro que la pantalla). */
  exportarSugeridas(): void {
    descargarExcel(
      "compras-sugeridas",
      this.filasVisibles().map((f) => ({
        codigo: f.sugerida.codigo,
        insumo: f.sugerida.nombre,
        unidad: f.sugerida.unidadBase,
        stockActual: f.sugerida.stockActual,
        stockMinimo: f.sugerida.stockMinimo,
        reservado: f.sugerida.reservado,
        demanda: f.sugerida.demanda,
        pendienteEnOrdenes: f.sugerida.pendienteEnOrdenes,
        aComprar: f.sugerida.aComprar,
        costoPromedio: f.sugerida.costoPromedio,
        marcada: f.marcada ? "Sí" : "No",
        paquetes: f.paquetes,
        unidadesPorPaquete: f.unidadesPorPaquete,
        costoTotal: f.costoTotal,
      })),
      "Compras sugeridas",
    );
  }
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly trabajando = signal(false);

  // Sugeridas
  readonly dias = signal(3);
  readonly soloAComprar = signal(true);
  readonly filasCompra = signal<FilaCompra[]>([]);
  readonly cargandoSugeridas = signal(false);
  readonly proveedorParaOrden = signal("");
  readonly filasVisibles = computed(() =>
    this.soloAComprar() ? this.filasCompra().filter((f) => f.sugerida.aComprar > 0 || f.marcada) : this.filasCompra(),
  );
  readonly marcadas = computed(() => this.filasCompra().filter((f) => f.marcada));
  readonly totalOrden = computed(() => this.marcadas().reduce((acc, f) => acc + Number(f.costoTotal || 0), 0));

  // Órdenes
  readonly filtroEstado = signal<EstadoOc | "">("");
  readonly ordenes = signal<OrdenCompraResumen[]>([]);
  readonly orden = signal<OrdenCompraDetalle | null>(null);
  readonly filasRecepcion = signal<FilaRecepcion[]>([]);
  readonly notaRecepcion = signal("");

  readonly tablaOrdenes = new Tabla(() => this.ordenes(), {
    id: (o) => o.id,
    porPagina: 10,
    nombreCsv: "ordenes-compra",
    csv: (o) => ({
      orden: o.numero,
      proveedor: o.proveedor,
      fecha: o.fecha,
      estado: ETIQUETA_OC[o.estado],
      lineas: o.lineas,
      total: o.total,
    }),
  });

  // Proveedores
  readonly proveedores = signal<Proveedor[]>([]);
  readonly tablaProveedores = new Tabla(() => this.proveedores(), {
    id: (p) => p.id,
    porPagina: 10,
    nombreCsv: "proveedores",
    csv: (p) => ({
      nombre: p.nombre,
      ruc: p.ruc ?? "",
      telefono: p.telefono ?? "",
      estado: p.activo ? "Activo" : "Inactivo",
    }),
  });
  readonly proveedoresActivos = computed(() => this.proveedores().filter((p) => p.activo));
  readonly proveedorForm = this.fb.nonNullable.group({
    nombre: ["", Validators.required],
    ruc: ["", Validators.pattern(/^(\d{11})?$/)],
    telefono: [""],
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([this.cargarProveedores(), this.cargarSugeridas(), this.cargarOrdenes()]);
  }

  cambiarPestana(p: Pestana): void {
    this.pestana.set(p);
    this.error.set(null);
    this.aviso.set(null);
  }

  private async ejecutar<T>(accion: () => Promise<T>, fallo: string): Promise<T | undefined> {
    this.trabajando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    try {
      return await accion();
    } catch (err) {
      this.error.set(mensajeError(err, fallo));
      return undefined;
    } finally {
      this.trabajando.set(false);
    }
  }

  // ---------- Sugeridas ----------

  async cargarSugeridas(): Promise<void> {
    this.cargandoSugeridas.set(true);
    try {
      const lista = await this.api.sugeridas(this.dias());
      this.filasCompra.set(
        lista.map((s) => ({
          sugerida: s,
          marcada: false,
          paquetes: s.aComprar,
          unidadesPorPaquete: 1,
          costoTotal: Math.round(s.aComprar * s.costoPromedio * 100) / 100,
        })),
      );
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudo calcular la lista sugerida."));
    } finally {
      this.cargandoSugeridas.set(false);
    }
  }

  /** Fuerza la reevaluación de los computed tras editar una fila en sitio. */
  refrescarFilas(): void {
    this.filasCompra.update((f) => [...f]);
  }

  marcarTodas(valor: boolean): void {
    for (const f of this.filasVisibles()) if (f.sugerida.aComprar > 0 || !valor) f.marcada = valor;
    this.refrescarFilas();
  }

  async crearOrdenDesdeSugeridas(): Promise<void> {
    const lineas = this.marcadas()
      .filter((f) => f.paquetes > 0 && f.unidadesPorPaquete > 0)
      .map((f) => ({
        insumoId: f.sugerida.insumoId,
        paquetes: Number(f.paquetes),
        unidadesPorPaquete: Number(f.unidadesPorPaquete),
        costoTotal: Number(f.costoTotal || 0),
      }));
    if (!this.proveedorParaOrden() || !lineas.length) return;

    const orden = await this.ejecutar(
      () => this.api.crearOrden({ proveedorId: this.proveedorParaOrden(), lineas }),
      "No se pudo crear la orden.",
    );
    if (!orden) return;
    await Promise.all([this.cargarSugeridas(), this.cargarOrdenes()]);
    this.pestana.set("ordenes");
    this.abrirOrden(orden);
    this.aviso.set(`Orden #${orden.numero} creada en borrador. Revísala y márcala como enviada.`);
  }

  // ---------- Órdenes ----------

  async cargarOrdenes(): Promise<void> {
    try {
      this.ordenes.set(await this.api.ordenes(this.filtroEstado() || undefined));
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudieron cargar las órdenes."));
    }
  }

  async verOrden(id: string): Promise<void> {
    const orden = await this.ejecutar(() => this.api.orden(id), "No se pudo abrir la orden.");
    if (orden) this.abrirOrden(orden);
  }

  private abrirOrden(orden: OrdenCompraDetalle): void {
    this.orden.set(orden);
    this.notaRecepcion.set("");
    this.filasRecepcion.set(
      orden.lineas.map((l) => {
        const pendiente = Math.max(0, Number(l.cantidadBase) - Number(l.cantidadRecibida));
        const porPaquete = Number(l.unidadesPorPaquete);
        const paquetes = porPaquete > 0 ? Math.round((pendiente / porPaquete) * 1000) / 1000 : 0;
        return {
          lineaId: l.id,
          nombre: `${l.codigo} · ${l.nombre}`,
          unidadBase: l.unidadBase,
          pendiente,
          marcada: pendiente > 0,
          paquetes,
          unidadesPorPaquete: porPaquete,
          costoTotal: Math.round(pendiente * Number(l.costoUnitario) * 100) / 100,
        };
      }),
    );
  }

  async cambiarEstadoOrden(estado: EstadoOc): Promise<void> {
    const o = this.orden();
    if (!o) return;
    if (estado === "anulada" && !confirm(`¿Anular la orden #${o.numero}?`)) return;
    const actualizada = await this.ejecutar(
      () => this.api.actualizarOrden(o.id, { estado }),
      "No se pudo cambiar el estado.",
    );
    if (!actualizada) return;
    this.abrirOrden(actualizada);
    this.aviso.set(`Orden #${o.numero}: ${ETIQUETA_OC[estado].toLowerCase()}.`);
    await this.cargarOrdenes();
  }

  async recibir(): Promise<void> {
    const o = this.orden();
    if (!o) return;
    const lineas = this.filasRecepcion()
      .filter((f) => f.marcada && f.paquetes > 0 && f.unidadesPorPaquete > 0)
      .map((f) => ({
        lineaId: f.lineaId,
        paquetes: Number(f.paquetes),
        unidadesPorPaquete: Number(f.unidadesPorPaquete),
        costoTotal: Number(f.costoTotal || 0),
      }));
    if (!lineas.length) return;
    const actualizada = await this.ejecutar(
      () => this.api.recepcion(o.id, { lineas, nota: this.notaRecepcion() || undefined }),
      "No se pudo registrar la recepción.",
    );
    if (!actualizada) return;
    this.abrirOrden(actualizada);
    this.aviso.set(`Recepción registrada: el stock y el costo promedio se actualizaron en el Kardex.`);
    await Promise.all([this.cargarOrdenes(), this.cargarSugeridas()]);
  }

  cantidadRecibir(f: FilaRecepcion): number {
    return Math.round(Number(f.paquetes) * Number(f.unidadesPorPaquete) * 1000) / 1000;
  }

  // ---------- Proveedores ----------

  async cargarProveedores(): Promise<void> {
    try {
      const lista = await this.api.proveedores();
      this.proveedores.set(lista);
      if (!this.proveedorParaOrden()) this.proveedorParaOrden.set(lista.find((p) => p.activo)?.id ?? "");
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudieron cargar los proveedores."));
    }
  }

  async crearProveedor(): Promise<void> {
    if (this.proveedorForm.invalid) return;
    const v = this.proveedorForm.getRawValue();
    const p = await this.ejecutar(
      () => this.api.crearProveedor({ nombre: v.nombre, ruc: v.ruc || undefined, telefono: v.telefono || undefined }),
      "No se pudo crear el proveedor.",
    );
    if (!p) return;
    this.proveedorForm.reset();
    this.aviso.set(`Proveedor "${p.nombre}" creado.`);
    await this.cargarProveedores();
  }

  async alternarProveedor(p: Proveedor): Promise<void> {
    const r = await this.ejecutar(
      () => this.api.actualizarProveedor(p.id, { activo: !p.activo }),
      "No se pudo actualizar el proveedor.",
    );
    if (r) await this.cargarProveedores();
  }
}
