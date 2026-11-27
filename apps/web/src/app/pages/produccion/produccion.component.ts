import { revisarFormulario } from "../../core/formularios/faltantes";
import { AvisosService } from "../../core/avisos/avisos.service";
import { Component, HostListener, OnInit, computed, inject, signal } from "@angular/core";
import { FotosPedidoComponent } from "../../shared/fotos/fotos-pedido.component";
import { RegistrarMermaComponent } from "../../shared/merma/registrar-merma.component";
import { InsumosService } from "../../core/catalogo/insumos.service";
import type { Insumo } from "../../core/catalogo/catalogo.types";
import { IconComponent } from "../../shared/icon/icon.component";
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import {
  ConsultasService,
  PedidosService,
  UsuariosService,
  type Usuario,
} from "../../core/pedidos/pedidos.service";
import type { Consulta, PedidoDetalle } from "../../core/pedidos/pedidos.types";
import { FOTOS_PEDIDO, validarTransicion } from "@erp/shared";
import { AuthService } from "../../core/auth/auth.service";
import { mensajeError } from "../../core/http/errores";
import { esUnidadEntera } from "@erp/shared";
import { cantidad, cuando } from "../../core/util/formato";
import type { NombreIcono } from "../../shared/icon/icon.component";
import { usarPolling } from "../../core/util/polling";
import { CLASE_ESTADO_PEDIDO, ETIQUETA_ESTADO_PEDIDO } from "../../core/util/formato";
import { descargarExcel } from "../../shared/tabla/excel";

interface LineaConsumo {
  insumoId: string;
  nombre: string;
  cantidadReceta: number;
}

@Component({
  selector: "app-produccion",
  imports: [ReactiveFormsModule, IconComponent, FotosPedidoComponent, RegistrarMermaComponent],
  templateUrl: "./produccion.component.html",
})
export class ProduccionComponent implements OnInit {
  private readonly avisosFlotantes = inject(AvisosService);
  private readonly pedidosService = inject(PedidosService);
  private readonly consultasService = inject(ConsultasService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);

  /** Hoja de producción en Excel: un renglón por producto de cada pedido del tablero. */
  exportarExcel(): void {
    const pedidos = [...this.pendientes(), ...this.enArmado(), ...this.listos()];
    void descargarExcel(
      "produccion",
      pedidos.flatMap((p) =>
        p.items.map((i) => ({
          pedido: p.codigo,
          estado: ETIQUETA_ESTADO_PEDIDO[p.estado],
          fechaEntrega: p.fechaEntrega,
          hora: p.horaEntrega.slice(0, 5),
          producto: i.producto,
          talla: i.talla,
          cantidad: i.cantidad,
          flor: i.flor,
          papel: i.papel,
          extras: i.extras.join(", "),
          cambios: i.cambios.map((c) => c.descripcion).join("; "),
          dedicatoria: p.dedicatoria,
        })),
      ),
      { titulo: "Hoja de producción" },
    );
  }
  readonly pendientes = signal<PedidoDetalle[]>([]);
  readonly enArmado = signal<PedidoDetalle[]>([]);
  readonly listos = signal<PedidoDetalle[]>([]);

  readonly encargadas = signal<Usuario[]>([]);
  readonly seleccionado = signal<PedidoDetalle | null>(null);
  readonly cargandoDetalle = signal(false);
  readonly consultaAbierta = signal<Consulta | null>(null);
  readonly lineasConsumo = signal<LineaConsumo[]>([]);
  private readonly insumosService = inject(InsumosService);
  /** Insumos para el modal de merma; se cargan al abrirlo. */
  readonly insumosMerma = signal<Insumo[] | null>(null);

  async abrirMerma(): Promise<void> {
    this.insumosMerma.set(await this.insumosService.list());
  }
  /** Insumos que pide el pedido pendiente, con lo que hay en almacén (solo consulta). */
  readonly recetaPendiente = signal<{ insumoId: string; nombre: string; unidadBase: string; cantidad: number; stock: number }[] | null>(null);
  readonly faltaStock = computed(() => (this.recetaPendiente() ?? []).some((l) => l.stock < l.cantidad));
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly resolverForm = this.fb.nonNullable.group({ respuesta: ["", Validators.required] });

  readonly consumoForm: FormGroup<{ lineas: FormArray<FormGroup> }> = this.fb.group({
    lineas: this.fb.array<FormGroup>([]),
  });
  get lineasForm(): FormArray<FormGroup> {
    return this.consumoForm.get("lineas") as FormArray<FormGroup>;
  }

  readonly cuando = cuando;
  readonly claseEstado = CLASE_ESTADO_PEDIDO;
  readonly etiquetaEstado = ETIQUETA_ESTADO_PEDIDO;
  readonly cantidad = cantidad;
  readonly esUnidadEntera = esUnidadEntera;

  readonly encargadaSeleccionada = computed(() => this.seleccionado()?.encargadaId ?? "");

  /** Las tres columnas del tablero, en orden de flujo. */
  readonly columnas = computed<
    { clave: string; titulo: string; ayuda: string; vacio: string; icono: NombreIcono; pedidos: PedidoDetalle[] }[]
  >(() => [
    { clave: "pendiente", titulo: "Pendiente", ayuda: "Por armar", vacio: "Sin pedidos por armar", icono: "reloj", pedidos: this.pendientes() },
    { clave: "en_armado", titulo: "En armado", ayuda: "En la mesa", vacio: "Nada en armado", icono: "flor", pedidos: this.enArmado() },
    { clave: "listo", titulo: "Listo", ayuda: "Para despacho", vacio: "Nada listo todavía", icono: "check", pedidos: this.listos() },
  ]);

  /** Minutos que faltan para la entrega (negativo = atrasado), en hora de Lima. */
  private minutosParaEntrega(p: PedidoDetalle): number {
    const entrega = Date.parse(`${p.fechaEntrega}T${p.horaEntrega.slice(0, 5)}:00-05:00`);
    return Math.round((entrega - Date.now()) / 60_000);
  }

  /** Badge de hora y texto del pie: atrasado, entrega en menos de 2 h, o normal. */
  estadoTiempo(p: PedidoDetalle): { tono: "normal" | "pronto" | "atrasado"; texto: string } {
    if (p.estado === "listo") return { tono: "normal", texto: "" };
    const min = this.minutosParaEntrega(p);
    if (min < 0) return { tono: "atrasado", texto: `Atrasado ${this.duracion(-min)}` };
    if (min <= 120) return { tono: "pronto", texto: `Entrega en ${this.duracion(min)}` };
    return { tono: "normal", texto: "" };
  }

  private duracion(min: number): string {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    return h < 24 ? `${h} h ${min % 60 ? (min % 60) + " min" : ""}`.trim() : `${Math.floor(h / 24)} d`;
  }

  /** "2× Delirio rosé M · Susurro Pink S" */
  resumenItems(p: PedidoDetalle): string {
    // La lista trae el resumen ya armado; el detalle trae los ítems.
    if (p.items?.length) return p.items.map((i) => `${i.cantidad > 1 ? i.cantidad + "× " : ""}${i.producto} ${i.talla}`).join(" · ");
    return p.resumen ?? "";
  }

  nombreEncargada(p: PedidoDetalle): string {
    return this.encargadas().find((u) => u.id === p.encargadaId)?.nombre ?? "Sin asignar";
  }

  /** Misma regla que valida la API: despachar es tarea de delivery/vendedora/admin, no de producción. */
  readonly puedeDespachar = computed(() => {
    const rol = this.auth.user()?.rol;
    return !!rol && validarTransicion(rol, "listo", "en_camino").ok;
  });

  /** Fotos del pedido abierto; sin al menos una no se despacha (lo valida también el API). */
  readonly cantidadFotos = signal(0);
  readonly minFotos = FOTOS_PEDIDO.min;

  constructor() {
    // Spec sección 8: el tablero se refresca cada 15 s (no toca el pedido abierto).
    usarPolling(() => this.cargarTablero());
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    this.encargadas.set(await this.usuariosService.list("produccion"));
    await this.cargarTablero();
    this.loading.set(false);
  }

  private async cargarTablero(): Promise<void> {
    const [pendientes, enArmado, listos] = await Promise.all([
      this.pedidosService.list({ estado: "pendiente" }),
      this.pedidosService.list({ estado: "en_armado" }),
      this.pedidosService.list({ estado: "listo" }),
    ]);
    // Por fecha y luego hora: un pedido de mañana a las 09:00 va después de uno de hoy a las 15:00.
    const porEntrega = (a: PedidoDetalle, b: PedidoDetalle) =>
      `${a.fechaEntrega} ${a.horaEntrega}`.localeCompare(`${b.fechaEntrega} ${b.horaEntrega}`);
    this.pendientes.set(pendientes.sort(porEntrega));
    this.enArmado.set(enArmado.sort(porEntrega));
    this.listos.set(listos.sort(porEntrega));
  }

  async seleccionar(pedido: PedidoDetalle): Promise<void> {
    this.error.set(null);
    this.cantidadFotos.set(0);
    // El panel se abre al instante con lo que ya se ve en la tarjeta; el detalle llega después.
    if (this.seleccionado()?.id !== pedido.id) {
      this.seleccionado.set({ ...pedido, items: pedido.items ?? [] });
      this.consultaAbierta.set(null);
      this.recetaPendiente.set(null);
    }
    this.cargandoDetalle.set(true);
    const detalle = await this.pedidosService.get(pedido.id).finally(() => this.cargandoDetalle.set(false));
    if (this.seleccionado()?.id !== pedido.id) return;
    this.seleccionado.set(detalle);

    const abiertas = await this.consultasService.list("abierta");
    this.consultaAbierta.set(abiertas.find((c) => c.pedidoId === detalle.id) ?? null);

    if (detalle.estado === "pendiente") {
      const lineas = await this.pedidosService.recetaEfectiva(detalle.id);
      if (this.seleccionado()?.id === detalle.id) this.recetaPendiente.set(lineas);
    }

    if (detalle.estado === "en_armado") {
      const lineas = await this.pedidosService.recetaEfectiva(detalle.id);
      this.lineasConsumo.set(lineas.map((l) => ({ insumoId: l.insumoId, nombre: l.nombre, cantidadReceta: l.cantidad })));
      this.lineasForm.clear();
      for (const l of lineas) {
        this.lineasForm.push(
          this.fb.group({
            insumoId: [l.insumoId],
            nombre: [l.nombre],
            unidadBase: [l.unidadBase],
            cantidadReceta: [l.cantidad],
            stock: [l.stock],
            cantidadUsada: [l.cantidad, [Validators.required, Validators.min(0)]],
            perdido: [0, [Validators.required, Validators.min(0)]],
          }),
        );
      }
    }
  }

  cerrar(): void {
    this.seleccionado.set(null);
  }

  @HostListener("document:keydown.escape")
  alEscape(): void {
    if (this.insumosMerma()) this.insumosMerma.set(null);
    else if (this.seleccionado()) this.cerrar();
  }

  /** Lo que se usó de más y va en el arreglo (flores extra para que se vea mejor). No es merma. */
  extraEnRamo(linea: { cantidadReceta: number; cantidadUsada: number; perdido: number }): number {
    const usado = Number(linea.cantidadUsada || 0);
    const perdido = Number(linea.perdido || 0);
    return Math.round(Math.max(0, usado - perdido - linea.cantidadReceta) * 1000) / 1000;
  }

  perdidoInvalido(linea: { cantidadUsada: number; perdido: number }): boolean {
    return Number(linea.perdido || 0) > Number(linea.cantidadUsada || 0);
  }


  /** Stock que quedaría tras confirmar con lo escrito en "Usado". */
  queda(linea: { stock: number; cantidadUsada: number }): number {
    return linea.stock - Number(linea.cantidadUsada || 0);
  }

  async asignarEncargada(encargadaId: string): Promise<void> {
    const pedido = this.seleccionado();
    if (!pedido) return;
    const actualizado = await this.pedidosService.asignar(pedido.id, { encargadaId: encargadaId || null });
    this.seleccionado.set(actualizado);
  }

  async pasarAEnArmado(): Promise<void> {
    const pedido = this.seleccionado();
    if (!pedido) return;
    this.error.set(null);
    try {
      await this.pedidosService.transicion(pedido.id, "en_armado");
      this.avisosFlotantes.exito(`${pedido.codigo} pasó a En armado`, "Registra lo que usas y confirma el consumo al terminar.");
      await this.cargarTablero();
      await this.seleccionar({ ...pedido, estado: "en_armado" });
    } catch (err) {
      this.error.set(
        mensajeError(err, "No se pudo pasar a en_armado. Revisa que tenga encargada y no haya consultas abiertas."),
      );
    }
  }

  async confirmarConsumo(): Promise<void> {
    const pedido = this.seleccionado();
    if (!pedido) return;
    if (!revisarFormulario(this.consumoForm, this.avisosFlotantes)) return;
    this.guardando.set(true);
    this.error.set(null);
    try {
      const lineas = this.lineasForm.getRawValue().map((l) => ({
        insumoId: l["insumoId"] as string,
        cantidadUsada: Number(l["cantidadUsada"]),
        merma: Number(l["perdido"] || 0),
      }));
      if (lineas.some((l) => l.merma > l.cantidadUsada)) {
        this.error.set("En «Se perdió» no puede ir más de lo que usaste.");
        this.guardando.set(false);
        return;
      }
      await this.pedidosService.confirmarConsumo(pedido.id, lineas);
      this.avisosFlotantes.exito(`${pedido.codigo} está listo`, "Sube la foto del arreglo para que se pueda despachar.");
      await this.cargarTablero();
      await this.seleccionar({ ...pedido, estado: "listo" });
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudo confirmar el consumo."));
      this.avisosFlotantes.error(mensajeError(err, "No se pudo confirmar el consumo."));
    } finally {
      this.guardando.set(false);
    }
  }

  async pasarAEnCamino(): Promise<void> {
    const pedido = this.seleccionado();
    if (!pedido) return;
    this.error.set(null);
    try {
      await this.pedidosService.transicion(pedido.id, "en_camino");
      this.avisosFlotantes.exito(`${pedido.codigo} salió a reparto`);
      await this.cargarTablero();
      this.cerrar();
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudo pasar a en camino."));
      this.avisosFlotantes.error(mensajeError(err, "No se pudo pasar a en camino."));
    }
  }

  async resolverConsulta(estado: "aprobada" | "rechazada"): Promise<void> {
    const consulta = this.consultaAbierta();
    if (!consulta) return;
    if (!revisarFormulario(this.resolverForm, this.avisosFlotantes)) return;
    this.error.set(null);
    try {
      await this.consultasService.resolver(consulta.id, { estado, respuesta: this.resolverForm.value.respuesta! });
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudo resolver la consulta."));
      this.avisosFlotantes.error(mensajeError(err, "No se pudo resolver la consulta."));
      return;
    }
    this.resolverForm.reset();
    this.avisosFlotantes.exito(estado === "aprobada" ? "Consulta aprobada" : "Consulta rechazada", "Se avisó a la vendedora.");
    const pedido = this.seleccionado();
    if (pedido) await this.seleccionar(pedido);
  }
}
