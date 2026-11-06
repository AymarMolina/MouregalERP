import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import type { Canal, Talla } from "@erp/shared";
import { CANAL, TALLA } from "@erp/shared";
import type { Distrito, Producto } from "../../core/catalogo/catalogo.types";
import { DistritosService } from "../../core/catalogo/distritos.service";
import { ProductosService } from "../../core/catalogo/productos.service";
import { CotizacionesService, PedidosService } from "../../core/pedidos/pedidos.service";
import type { ResultadoCotizacion } from "../../core/pedidos/pedidos.types";

@Component({
  selector: "app-pedido-nuevo",
  imports: [ReactiveFormsModule],
  templateUrl: "./pedido-nuevo.component.html",
})
export class PedidoNuevoComponent implements OnInit {
  private readonly productosService = inject(ProductosService);
  private readonly distritosService = inject(DistritosService);
  private readonly cotizacionesService = inject(CotizacionesService);
  private readonly pedidosService = inject(PedidosService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly canales: Canal[] = [...CANAL];
  readonly tallas: Talla[] = [...TALLA];

  readonly productos = signal<Producto[]>([]);
  readonly distritos = signal<Distrito[]>([]);
  readonly loading = signal(true);
  readonly cotizando = signal(false);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly cotizacion = signal<ResultadoCotizacion | null>(null);
  readonly extraIds = signal<Set<string>>(new Set());

  readonly productoSeleccionado = computed(() => this.productos().find((p) => p.id === this.form.value.productoId));

  readonly muestraCambioNoListado = computed(() => {
    const c = this.cotizacion();
    if (!c) return false;
    const flor = c.opciones.flores.find((o) => o.insumoId === c.florId);
    const papel = c.opciones.papeles.find((o) => o.insumoId === c.papelId);
    return flor?.estado === "consultar" || papel?.estado === "consultar";
  });

  readonly adelanto = computed(() => {
    const c = this.cotizacion();
    const pct = Number(this.form.value.porcentajeAdelanto ?? 50);
    return c ? Math.round(((c.total * pct) / 100 + Number.EPSILON) * 100) / 100 : 0;
  });

  readonly saldo = computed(() => {
    const c = this.cotizacion();
    return c ? Math.round((c.total - this.adelanto() + Number.EPSILON) * 100) / 100 : 0;
  });

  readonly form = this.fb.nonNullable.group({
    canal: ["vendedora" as Canal, Validators.required],
    productoId: ["", Validators.required],
    talla: ["S" as Talla, Validators.required],
    cantidad: [1, [Validators.required, Validators.min(1)]],
    distritoId: ["", Validators.required],
    fechaEntrega: ["", Validators.required],
    horaEntrega: ["", Validators.required],
    direccion: ["", Validators.required],
    referencia: [""],
    telefonoReceptor: ["", Validators.required],
    nombreReceptor: ["", Validators.required],
    dedicatoria: [""],
    clienteNombre: ["", Validators.required],
    clienteTelefono: [""],
    porcentajeAdelanto: [50, [Validators.required, Validators.min(0), Validators.max(100)]],
    cambioNoListado: [""],
  });

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    const [productos, distritos] = await Promise.all([this.productosService.list(), this.distritosService.list()]);
    this.productos.set(productos.filter((p) => p.activo));
    this.distritos.set(distritos.filter((d) => d.activo));
    this.loading.set(false);
  }

  async onProductoChange(): Promise<void> {
    this.cotizacion.set(null);
    this.extraIds.set(new Set());
    await this.actualizarCotizacion(true);
  }

  async onCambioBasico(): Promise<void> {
    await this.actualizarCotizacion(false);
  }

  async elegirFlor(insumoId: string): Promise<void> {
    await this.actualizarCotizacion(false, { florId: insumoId });
  }

  async elegirPapel(insumoId: string): Promise<void> {
    await this.actualizarCotizacion(false, { papelId: insumoId });
  }

  async toggleExtra(id: string): Promise<void> {
    const actual = new Set(this.extraIds());
    if (actual.has(id)) actual.delete(id);
    else actual.add(id);
    this.extraIds.set(actual);
    await this.actualizarCotizacion(false);
  }

  private async actualizarCotizacion(
    reiniciarSeleccion: boolean,
    forzar?: { florId?: string; papelId?: string },
  ): Promise<void> {
    const v = this.form.getRawValue();
    if (!v.productoId || !v.distritoId) return;

    this.cotizando.set(true);
    this.error.set(null);
    try {
      const anterior = reiniciarSeleccion ? null : this.cotizacion();
      const resultado = await this.cotizacionesService.cotizar({
        productoId: v.productoId,
        talla: v.talla,
        cantidad: v.cantidad,
        florId: forzar?.florId ?? (reiniciarSeleccion ? undefined : (anterior?.florId ?? undefined)),
        papelId: forzar?.papelId ?? (reiniciarSeleccion ? undefined : (anterior?.papelId ?? undefined)),
        extraIds: [...this.extraIds()],
        distritoId: v.distritoId,
      });
      this.cotizacion.set(resultado);
    } catch {
      this.error.set("No se pudo cotizar con esta combinación.");
    } finally {
      this.cotizando.set(false);
    }
  }

  async confirmarPedido(): Promise<void> {
    const c = this.cotizacion();
    if (!c || this.form.invalid) return;
    const v = this.form.getRawValue();

    this.enviando.set(true);
    this.error.set(null);
    try {
      const pedido = await this.pedidosService.crear({
        canal: v.canal,
        cliente: { nombre: v.clienteNombre, telefono: v.clienteTelefono || undefined },
        items: [
          {
            productoId: v.productoId,
            talla: v.talla,
            cantidad: v.cantidad,
            florId: c.florId,
            papelId: c.papelId,
            extraIds: [...this.extraIds()],
            cambioNoListado: v.cambioNoListado || undefined,
          },
        ],
        fechaEntrega: v.fechaEntrega,
        horaEntrega: v.horaEntrega,
        distritoId: v.distritoId,
        direccion: v.direccion,
        referencia: v.referencia || undefined,
        telefonoReceptor: v.telefonoReceptor,
        nombreReceptor: v.nombreReceptor,
        dedicatoria: v.dedicatoria || undefined,
        porcentajeAdelanto: v.porcentajeAdelanto,
      });
      await this.router.navigate(["/pedidos", pedido.id]);
    } catch {
      this.error.set("No se pudo crear el pedido. Revisa los datos e intenta de nuevo.");
    } finally {
      this.enviando.set(false);
    }
  }
}
