import { DialogoService } from "../../core/dialogo/dialogo.service";
import { AvisosService } from "../../core/avisos/avisos.service";
import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { CobroComponent, type EstadoCobro } from "../../shared/cobro/cobro.component";
import { IconComponent } from "../../shared/icon/icon.component";
import { Tabla } from "../../shared/tabla/tabla";
import { TABLA_CONTROLES } from "../../shared/tabla/tabla-controles.component";
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { mensajeError } from "../../core/http/errores";
import { PagosApi } from "../../core/operacion/operacion.service";
import type { Pago, PedidoConSaldo } from "../../core/operacion/operacion.types";
import {
  CLASE_ESTADO_PAGO,
  CLASE_ESTADO_PEDIDO,
  ETIQUETA_ESTADO_PEDIDO,
  hora,
  soles,
} from "../../core/util/formato";


@Component({
  selector: "app-pagos",
  imports: [FormsModule, ReactiveFormsModule, RouterLink, IconComponent, CobroComponent, ...TABLA_CONTROLES],
  templateUrl: "./pagos.component.html",
})
export class PagosComponent implements OnInit {
  private readonly dialogo = inject(DialogoService);
  private readonly avisosFlotantes = inject(AvisosService);
  private readonly api = inject(PagosApi);
  private readonly fb = inject(FormBuilder);

  readonly soles = soles;
  readonly hora = hora;
  readonly claseEstado = CLASE_ESTADO_PEDIDO;
  readonly etiquetaEstado = ETIQUETA_ESTADO_PEDIDO;
  readonly clasePago = CLASE_ESTADO_PAGO;

  readonly soloConSaldo = signal(true);
  readonly fecha = signal("");
  readonly busqueda = signal("");
  readonly filas = signal<PedidoConSaldo[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly trabajando = signal(false);
  readonly seleccionadoId = signal<string | null>(null);

  readonly seleccionado = computed(() => this.filas().find((f) => f.id === this.seleccionadoId()) ?? null);

  readonly visibles = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.filas();
    return this.filas().filter(
      (f) =>
        f.codigo.toLowerCase().includes(q) ||
        f.clienteNombre.toLowerCase().includes(q) ||
        (f.clienteTelefono ?? "").includes(q),
    );
  });

  readonly tabla = new Tabla(() => this.visibles(), {
    id: (f) => f.id,
    porPagina: 12,
    nombreCsv: "pagos-saldos",
    titulo: "Pagos y saldos pendientes",
    totales: ["total", "pagado", "saldo"],
    csv: (f) => ({
      pedido: f.codigo,
      cliente: f.clienteNombre,
      telefono: f.clienteTelefono ?? "",
      fecha_entrega: f.fechaEntrega,
      estado: ETIQUETA_ESTADO_PEDIDO[f.estado],
      total: f.total,
      pagado: f.totalPagado,
      saldo: f.saldo,
    }),
  });

  readonly totalSaldo = computed(() => this.visibles().reduce((acc, f) => acc + f.saldo, 0));

  readonly pagoForm = this.fb.nonNullable.group({
    monto: [0, [Validators.required, Validators.min(0.01)]],
  });
  /** Cuánto paga ahora (puede ser menos que el saldo: 127 de 250). */
  readonly montoCobro = toSignal(this.pagoForm.controls.monto.valueChanges, { initialValue: 0 });
  /** Cómo lo paga: uno o varios métodos. */
  readonly cobro = signal<EstadoCobro>({ partes: [], error: null });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.loading.set(true);
    try {
      this.filas.set(await this.api.resumen({ saldo: this.soloConSaldo(), fecha: this.fecha() || undefined }));
      this.error.set(null);
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudieron cargar los pagos."));
    } finally {
      this.loading.set(false);
    }
  }

  seleccionar(f: PedidoConSaldo): void {
    this.seleccionadoId.set(f.id);
    this.aviso.set(null);
    // El tipo (adelanto o saldo) lo deduce el API: aquí solo importa cuánto y cómo.
    // Lo que se espera cobrar: el link pendiente si hay uno, si no todo el saldo.
    this.pagoForm.reset({ monto: Number(this.pagoPendiente(f)?.monto ?? f.saldo) });
  }

  pagoPendiente(f: PedidoConSaldo): Pago | undefined {
    return f.pagos.find((p) => p.estado === "pendiente");
  }

  private async ejecutar(accion: () => Promise<unknown>, ok: string, fallo: string): Promise<void> {
    this.trabajando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    try {
      await accion();
      this.aviso.set(ok);
      this.avisosFlotantes.exito(ok);
      const id = this.seleccionadoId();
      await this.cargar();
      // Si el pedido dejó de tener saldo y se filtran solo con saldo, se cierra el panel.
      if (id && !this.filas().some((f) => f.id === id)) this.seleccionadoId.set(null);
    } catch (err) {
      this.error.set(mensajeError(err, fallo));
      this.avisosFlotantes.error(mensajeError(err, fallo));
    } finally {
      this.trabajando.set(false);
    }
  }

  generarLink(f: PedidoConSaldo): Promise<void> {
    return this.ejecutar(
      () => this.api.linkSaldo(f.id),
      `Link del saldo de ${f.codigo} generado y enviado al cliente.`,
      "No se pudo generar el link.",
    );
  }

  registrarPago(f: PedidoConSaldo): Promise<void> {
    const c = this.cobro();
    if (this.pagoForm.invalid || c.error || !c.partes.length) return Promise.resolve();
    const v = this.pagoForm.getRawValue();
    return this.ejecutar(
      () =>
        this.api.registrar(f.id, {
          partes: c.partes.map((p) => ({ metodo: p.metodo, monto: p.monto, referenciaExterna: p.referencia })),
        }),
      `Pago de ${soles(v.monto)} registrado en ${f.codigo}.`,
      "No se pudo registrar el pago.",
    );
  }

  async confirmar(p: Pago): Promise<void> {
    const ref = await this.dialogo.pedirTexto({
      titulo: `Confirmar pago de ${soles(p.monto)}`,
      detalle: "Marca el cobro como pagado.",
      aceptar: "Confirmar pago",
      campo: { etiqueta: "N° de operación o referencia", placeholder: "Opcional", opcional: true },
    });
    if (ref === null) return;
    return this.ejecutar(
      () => this.api.confirmar(p.id, ref || undefined),
      `Pago de ${soles(p.monto)} confirmado.`,
      "No se pudo confirmar el pago.",
    );
  }

  async anular(p: Pago): Promise<void> {
    const ok = await this.dialogo.confirmar({
      titulo: `Anular el cobro de ${soles(p.monto)}`,
      detalle: "El link de pago deja de funcionar. Esto no se puede deshacer.",
      aceptar: "Anular cobro",
      peligro: true,
    });
    if (!ok) return;
    return this.ejecutar(() => this.api.anular(p.id), "Cobro anulado.", "No se pudo anular el cobro.");
  }

  async copiar(url: string | null): Promise<void> {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.aviso.set("Link copiado al portapapeles.");
      this.avisosFlotantes.exito("Link copiado al portapapeles.");
    } catch {
      this.aviso.set(url);
      this.avisosFlotantes.exito(url);
    }
  }
}
