import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { IconComponent } from "../../shared/icon/icon.component";
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";
import type { MetodoPago, TipoPago } from "@erp/shared";
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

type MetodoManual = Exclude<MetodoPago, "link" | "shopify">;

const METODOS_MANUALES: { valor: MetodoManual; etiqueta: string }[] = [
  { valor: "yape", etiqueta: "Yape" },
  { valor: "plin", etiqueta: "Plin" },
  { valor: "transferencia", etiqueta: "Transferencia" },
  { valor: "efectivo", etiqueta: "Efectivo" },
];

@Component({
  selector: "app-pagos",
  imports: [FormsModule, ReactiveFormsModule, RouterLink, IconComponent],
  templateUrl: "./pagos.component.html",
})
export class PagosComponent implements OnInit {
  private readonly api = inject(PagosApi);
  private readonly fb = inject(FormBuilder);

  readonly soles = soles;
  readonly hora = hora;
  readonly claseEstado = CLASE_ESTADO_PEDIDO;
  readonly etiquetaEstado = ETIQUETA_ESTADO_PEDIDO;
  readonly clasePago = CLASE_ESTADO_PAGO;
  readonly metodos = METODOS_MANUALES;

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
        String(f.numero).includes(q.replace("#", "")) ||
        f.clienteNombre.toLowerCase().includes(q) ||
        (f.clienteTelefono ?? "").includes(q),
    );
  });

  readonly totalSaldo = computed(() => this.visibles().reduce((acc, f) => acc + f.saldo, 0));

  readonly pagoForm = this.fb.nonNullable.group({
    tipo: ["saldo" as TipoPago, Validators.required],
    metodo: ["yape" as MetodoManual, Validators.required],
    monto: [0, [Validators.required, Validators.min(0.01)]],
    referenciaExterna: [""],
  });

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
    this.pagoForm.reset({
      tipo: Number(f.totalPagado) > 0 ? "saldo" : "adelanto",
      metodo: "yape",
      monto: f.saldo,
      referenciaExterna: "",
    });
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
      const id = this.seleccionadoId();
      await this.cargar();
      // Si el pedido dejó de tener saldo y se filtran solo con saldo, se cierra el panel.
      if (id && !this.filas().some((f) => f.id === id)) this.seleccionadoId.set(null);
    } catch (err) {
      this.error.set(mensajeError(err, fallo));
    } finally {
      this.trabajando.set(false);
    }
  }

  generarLink(f: PedidoConSaldo): Promise<void> {
    return this.ejecutar(
      () => this.api.linkSaldo(f.id),
      `Link del saldo de #${f.numero} generado y enviado al cliente.`,
      "No se pudo generar el link.",
    );
  }

  registrarPago(f: PedidoConSaldo): Promise<void> {
    if (this.pagoForm.invalid) return Promise.resolve();
    const v = this.pagoForm.getRawValue();
    return this.ejecutar(
      () =>
        this.api.registrar(f.id, {
          tipo: v.tipo,
          metodo: v.metodo,
          monto: Number(v.monto),
          referenciaExterna: v.referenciaExterna || undefined,
        }),
      `Pago de ${soles(v.monto)} registrado en #${f.numero}.`,
      "No se pudo registrar el pago.",
    );
  }

  confirmar(p: Pago): Promise<void> {
    const ref = prompt("Referencia u operación del pago (opcional):") ?? undefined;
    return this.ejecutar(
      () => this.api.confirmar(p.id, ref || undefined),
      `Pago de ${soles(p.monto)} confirmado.`,
      "No se pudo confirmar el pago.",
    );
  }

  anular(p: Pago): Promise<void> {
    if (!confirm(`¿Anular el cobro pendiente de ${soles(p.monto)}?`)) return Promise.resolve();
    return this.ejecutar(() => this.api.anular(p.id), "Cobro anulado.", "No se pudo anular el cobro.");
  }

  async copiar(url: string | null): Promise<void> {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.aviso.set("Link copiado al portapapeles.");
    } catch {
      this.aviso.set(url);
    }
  }
}
