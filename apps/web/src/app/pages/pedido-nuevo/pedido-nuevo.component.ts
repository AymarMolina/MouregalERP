import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { IconComponent } from "../../shared/icon/icon.component";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import type { Canal, PedidoItemInput, Talla } from "@erp/shared";
import { CANAL, TALLA } from "@erp/shared";
import type { Distrito, Producto } from "../../core/catalogo/catalogo.types";
import { DistritosService } from "../../core/catalogo/distritos.service";
import { ProductosService } from "../../core/catalogo/productos.service";
import { mensajeError } from "../../core/http/errores";
import { CotizacionesService, PedidosService } from "../../core/pedidos/pedidos.service";
import type { ResultadoCotizacion, ResultadoCotizacionPedido } from "../../core/pedidos/pedidos.types";
import { hoyLima, soles } from "../../core/util/formato";

/** Ítem ya agregado al pedido, con lo necesario para mostrarlo. */
interface ItemCarrito {
  input: PedidoItemInput;
  producto: string;
  detalle: string;
}

@Component({
  selector: "app-pedido-nuevo",
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: "./pedido-nuevo.component.html",
})
export class PedidoNuevoComponent implements OnInit {
  private readonly productosService = inject(ProductosService);
  private readonly distritosService = inject(DistritosService);
  private readonly cotizacionesService = inject(CotizacionesService);
  private readonly pedidosService = inject(PedidosService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly soles = soles;
  readonly canales: Canal[] = [...CANAL];
  readonly tallas: Talla[] = [...TALLA];
  readonly hoy = hoyLima();

  readonly productos = signal<Producto[]>([]);
  readonly distritos = signal<Distrito[]>([]);
  readonly loading = signal(true);
  readonly cotizando = signal(false);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  /** Cotización del ítem que se está configurando. */
  readonly cotizacion = signal<ResultadoCotizacion | null>(null);
  readonly extraIds = signal<Set<string>>(new Set());

  /** Ítems agregados al pedido y la cotización del pedido completo. */
  readonly carrito = signal<ItemCarrito[]>([]);
  readonly resumen = signal<ResultadoCotizacionPedido | null>(null);
  readonly cotizandoResumen = signal(false);

  /** Talla elegida sin stock o sin receta, según el servidor. */
  readonly tallaNoDisponible = computed(() => {
    const c = this.cotizacion();
    return c?.opciones.tallas.find((t) => t.talla === c.talla && !t.disponible) ?? null;
  });

  readonly adelanto = computed(() => {
    const r = this.resumen();
    const pct = Number(this.form.value.porcentajeAdelanto ?? 50);
    return r ? Math.round(((r.total * pct) / 100 + Number.EPSILON) * 100) / 100 : 0;
  });

  readonly saldo = computed(() => {
    const r = this.resumen();
    return r ? Math.round((r.total - this.adelanto() + Number.EPSILON) * 100) / 100 : 0;
  });

  readonly itemForm = this.fb.nonNullable.group({
    productoId: ["", Validators.required],
    talla: ["S" as Talla, Validators.required],
    cantidad: [1, [Validators.required, Validators.min(1)]],
    cambioNoListado: [""],
  });

  readonly form = this.fb.nonNullable.group({
    canal: ["vendedora" as Canal, Validators.required],
    distritoId: ["", Validators.required],
    fechaEntrega: [hoyLima(), Validators.required],
    horaEntrega: ["", Validators.required],
    direccion: ["", Validators.required],
    referencia: [""],
    telefonoReceptor: ["", Validators.required],
    nombreReceptor: ["", Validators.required],
    dedicatoria: [""],
    clienteNombre: ["", Validators.required],
    clienteTelefono: [""],
    porcentajeAdelanto: [50, [Validators.required, Validators.min(0), Validators.max(100)]],
  });

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const [productos, distritos] = await Promise.all([this.productosService.list(), this.distritosService.list()]);
      this.productos.set(productos.filter((p) => p.activo));
      this.distritos.set(distritos.filter((d) => d.activo));
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudo cargar el catálogo."));
    } finally {
      this.loading.set(false);
    }
  }

  // ---------- Ítem en configuración ----------

  async onProductoChange(): Promise<void> {
    this.cotizacion.set(null);
    this.extraIds.set(new Set());
    await this.actualizarCotizacion(true);
  }

  async onCambioBasico(): Promise<void> {
    await this.actualizarCotizacion(false);
  }

  async onDistritoChange(): Promise<void> {
    await Promise.all([this.actualizarCotizacion(false), this.actualizarResumen()]);
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
    const item = this.itemForm.getRawValue();
    const distritoId = this.form.getRawValue().distritoId;
    if (!item.productoId || !distritoId) return;

    this.cotizando.set(true);
    this.error.set(null);
    try {
      const anterior = reiniciarSeleccion ? null : this.cotizacion();
      const resultado = await this.cotizacionesService.cotizar({
        productoId: item.productoId,
        talla: item.talla,
        cantidad: item.cantidad,
        florId: forzar?.florId ?? anterior?.florId ?? undefined,
        papelId: forzar?.papelId ?? anterior?.papelId ?? undefined,
        extraIds: [...this.extraIds()],
        distritoId,
        cambioNoListado: item.cambioNoListado || undefined,
        // Lo ya agregado al pedido también consume stock.
        itemsEnCarrito: this.carrito().map((c) => c.input),
      });
      this.cotizacion.set(resultado);
      this.extraIds.set(new Set(resultado.extraIds));
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudo cotizar con esta combinación."));
    } finally {
      this.cotizando.set(false);
    }
  }

  /** Agrega el ítem configurado al pedido y deja el formulario listo para otro. */
  async agregarAlPedido(): Promise<void> {
    const c = this.cotizacion();
    if (!c || !c.disponible || this.itemForm.invalid) return;
    const item = this.itemForm.getRawValue();
    const producto = this.productos().find((p) => p.id === c.productoId)?.nombre ?? "Producto";
    const flor = c.opciones.flores.find((o) => o.insumoId === c.florId)?.nombre;
    const papel = c.opciones.papeles.find((o) => o.insumoId === c.papelId)?.nombre;
    const extras = c.opciones.extras.filter((e) => c.extraIds.includes(e.id)).map((e) => e.nombre);

    this.carrito.update((lista) => [
      ...lista,
      {
        input: {
          productoId: c.productoId,
          talla: c.talla,
          cantidad: c.cantidad,
          florId: c.florId,
          papelId: c.papelId,
          extraIds: [...c.extraIds],
          cambioNoListado: item.cambioNoListado || undefined,
        },
        producto,
        detalle: [flor, papel, ...extras, item.cambioNoListado ? `“${item.cambioNoListado}”` : null]
          .filter(Boolean)
          .join(" · "),
      },
    ]);

    this.itemForm.reset({ productoId: "", talla: "S", cantidad: 1, cambioNoListado: "" });
    this.cotizacion.set(null);
    this.extraIds.set(new Set());
    await this.actualizarResumen();
  }

  async quitarDelPedido(indice: number): Promise<void> {
    this.carrito.update((lista) => lista.filter((_, i) => i !== indice));
    await Promise.all([this.actualizarResumen(), this.actualizarCotizacion(false)]);
  }

  // ---------- Pedido completo ----------

  private async actualizarResumen(): Promise<void> {
    const distritoId = this.form.getRawValue().distritoId;
    if (!this.carrito().length || !distritoId) {
      this.resumen.set(null);
      return;
    }
    this.cotizandoResumen.set(true);
    try {
      this.resumen.set(
        await this.cotizacionesService.cotizarPedido({
          items: this.carrito().map((c) => c.input),
          distritoId,
        }),
      );
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudo cotizar el pedido."));
    } finally {
      this.cotizandoResumen.set(false);
    }
  }

  async confirmarPedido(): Promise<void> {
    const r = this.resumen();
    if (!r || !r.disponible || this.form.invalid || !this.carrito().length) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();

    this.enviando.set(true);
    this.error.set(null);
    try {
      const pedido = await this.pedidosService.crear({
        canal: v.canal,
        cliente: { nombre: v.clienteNombre, telefono: v.clienteTelefono || undefined },
        items: this.carrito().map((c) => c.input),
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
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudo crear el pedido. Revisa los datos e intenta de nuevo."));
      // El stock pudo cambiar mientras se llenaba el formulario.
      await this.actualizarResumen();
    } finally {
      this.enviando.set(false);
    }
  }

  opcionTalla(talla: Talla) {
    return this.cotizacion()?.opciones.tallas.find((t) => t.talla === talla);
  }

  invalido(control: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[control];
    return c.invalid && c.touched;
  }
}
