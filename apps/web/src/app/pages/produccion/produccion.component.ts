import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { IconComponent } from "../../shared/icon/icon.component";
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import {
  ConsultasService,
  PedidosService,
  UsuariosService,
  type Usuario,
} from "../../core/pedidos/pedidos.service";
import type { Consulta, PedidoDetalle } from "../../core/pedidos/pedidos.types";
import { validarTransicion } from "@erp/shared";
import { AuthService } from "../../core/auth/auth.service";
import { mensajeError } from "../../core/http/errores";
import { esUnidadEntera } from "@erp/shared";
import { cantidad, cuando } from "../../core/util/formato";
import type { NombreIcono } from "../../shared/icon/icon.component";
import { usarPolling } from "../../core/util/polling";
import { ETIQUETA_ESTADO_PEDIDO } from "../../core/util/formato";
import { descargarExcel } from "../../shared/tabla/excel";

interface LineaConsumo {
  insumoId: string;
  nombre: string;
  cantidadReceta: number;
}

@Component({
  selector: "app-produccion",
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: "./produccion.component.html",
})
export class ProduccionComponent implements OnInit {
  private readonly pedidosService = inject(PedidosService);
  private readonly consultasService = inject(ConsultasService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);

  /** Hoja de producción en Excel: un renglón por producto de cada pedido del tablero. */
  exportarExcel(): void {
    const pedidos = [...this.pendientes(), ...this.enArmado(), ...this.listos()];
    descargarExcel(
      "produccion",
      pedidos.flatMap((p) =>
        p.items.map((i) => ({
          pedido: p.numero,
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
      "Producción",
    );
  }
  readonly pendientes = signal<PedidoDetalle[]>([]);
  readonly enArmado = signal<PedidoDetalle[]>([]);
  readonly listos = signal<PedidoDetalle[]>([]);

  readonly encargadas = signal<Usuario[]>([]);
  readonly seleccionado = signal<PedidoDetalle | null>(null);
  readonly consultaAbierta = signal<Consulta | null>(null);
  readonly lineasConsumo = signal<LineaConsumo[]>([]);
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
    // El listado de pedidos trae solo la cabecera; los ítems llegan al abrir el detalle.
    return (p.items ?? []).map((i) => `${i.cantidad > 1 ? i.cantidad + "× " : ""}${i.producto} ${i.talla}`).join(" · ");
  }

  nombreEncargada(p: PedidoDetalle): string {
    return this.encargadas().find((u) => u.id === p.encargadaId)?.nombre ?? "Sin asignar";
  }

  /** Misma regla que valida la API: despachar es tarea de delivery/vendedora/admin, no de producción. */
  readonly puedeDespachar = computed(() => {
    const rol = this.auth.user()?.rol;
    return !!rol && validarTransicion(rol, "listo", "en_camino").ok;
  });

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
    const detalle = await this.pedidosService.get(pedido.id);
    this.seleccionado.set(detalle);

    const abiertas = await this.consultasService.list("abierta");
    this.consultaAbierta.set(abiertas.find((c) => c.pedidoId === detalle.id) ?? null);

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
            cantidadUsada: [l.cantidad, [Validators.required, Validators.min(0)]],
          }),
        );
      }
    }
  }

  cerrar(): void {
    this.seleccionado.set(null);
  }

  merma(linea: { cantidadReceta: number; cantidadUsada: number }): number {
    return Math.max(0, linea.cantidadUsada - linea.cantidadReceta);
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
    if (!pedido || this.consumoForm.invalid) return;
    this.guardando.set(true);
    this.error.set(null);
    try {
      const lineas = this.lineasForm.getRawValue().map((l) => ({
        insumoId: l["insumoId"] as string,
        cantidadUsada: Number(l["cantidadUsada"]),
      }));
      await this.pedidosService.confirmarConsumo(pedido.id, lineas);
      await this.cargarTablero();
      this.cerrar();
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudo confirmar el consumo."));
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
      await this.cargarTablero();
      this.cerrar();
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudo pasar a en camino."));
    }
  }

  async resolverConsulta(estado: "aprobada" | "rechazada"): Promise<void> {
    const consulta = this.consultaAbierta();
    if (!consulta || this.resolverForm.invalid) return;
    this.error.set(null);
    try {
      await this.consultasService.resolver(consulta.id, { estado, respuesta: this.resolverForm.value.respuesta! });
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudo resolver la consulta."));
      return;
    }
    this.resolverForm.reset();
    const pedido = this.seleccionado();
    if (pedido) await this.seleccionar(pedido);
  }
}
