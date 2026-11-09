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
import { cuando } from "../../core/util/formato";
import { usarPolling } from "../../core/util/polling";

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

  readonly encargadaSeleccionada = computed(() => this.seleccionado()?.encargadaId ?? "");

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
    const porHora = (a: PedidoDetalle, b: PedidoDetalle) => a.horaEntrega.localeCompare(b.horaEntrega);
    this.pendientes.set(pendientes.sort(porHora));
    this.enArmado.set(enArmado.sort(porHora));
    this.listos.set(listos.sort(porHora));
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
