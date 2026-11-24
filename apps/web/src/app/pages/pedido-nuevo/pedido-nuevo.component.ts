import { Component, HostListener, OnInit, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { IconComponent } from "../../shared/icon/icon.component";
import { MapaComponent } from "../../shared/mapa/mapa.component";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import type { Canal, Coordenadas, MetodoCobroDirecto, PedidoItemInput, Talla, TipoEntrega } from "@erp/shared";
import { CANAL, DESCUENTO_MAX_VENDEDORA_PCT, TALLA } from "@erp/shared";
import { AuthService } from "../../core/auth/auth.service";
import type { Distrito, Producto } from "../../core/catalogo/catalogo.types";
import { DistritosService } from "../../core/catalogo/distritos.service";
import { ProductosService } from "../../core/catalogo/productos.service";
import { mensajeError } from "../../core/http/errores";
import { CotizacionesService, PedidosService } from "../../core/pedidos/pedidos.service";
import type { ResultadoCotizacion, ResultadoCotizacionPedido } from "../../core/pedidos/pedidos.types";
import { cantidad, diasDesdeHoy, hoyLima, soles } from "../../core/util/formato";
import type { NombreIcono } from "../../shared/icon/icon.component";

/** Ítem ya agregado al pedido, con lo necesario para mostrarlo. */
interface ItemCarrito {
  input: PedidoItemInput;
  producto: string;
  detalle: string;
}

/** Cómo paga lo de ahora: un método directo (ya cobrado) o un link que se envía. */
type MetodoPagoAhora = MetodoCobroDirecto | "link";

const METODOS_PAGO: { valor: MetodoPagoAhora; etiqueta: string; icono: NombreIcono }[] = [
  { valor: "efectivo", etiqueta: "Efectivo", icono: "ventas" },
  { valor: "yape", etiqueta: "Yape", icono: "telefono" },
  { valor: "plin", etiqueta: "Plin", icono: "telefono" },
  { valor: "tarjeta", etiqueta: "Tarjeta", icono: "pagos" },
  { valor: "transferencia", etiqueta: "Transferencia", icono: "enlace" },
  { valor: "link", etiqueta: "Enviar link", icono: "whatsapp" },
];

/** Pasos del kiosko: destino → productos → entrega y pago. */
export type Paso = 1 | 2 | 3;

const CANAL_INFO: Record<Canal, { etiqueta: string; icono: NombreIcono }> = {
  vendedora: { etiqueta: "En tienda", icono: "tienda" },
  whatsapp: { etiqueta: "WhatsApp", icono: "whatsapp" },
  shopify: { etiqueta: "Web (Shopify)", icono: "bolsa" },
};

@Component({
  selector: "app-pedido-nuevo",
  imports: [ReactiveFormsModule, IconComponent, MapaComponent],
  templateUrl: "./pedido-nuevo.component.html",
})
export class PedidoNuevoComponent implements OnInit {
  private readonly productosService = inject(ProductosService);
  private readonly distritosService = inject(DistritosService);
  private readonly cotizacionesService = inject(CotizacionesService);
  private readonly pedidosService = inject(PedidosService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly soles = soles;
  readonly cantidad = cantidad;
  readonly canales: Canal[] = [...CANAL];
  readonly tallas: Talla[] = [...TALLA];
  readonly hoy = hoyLima();
  readonly manana = diasDesdeHoy(1);
  readonly canalInfo = CANAL_INFO;
  readonly horasRapidas = ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00"];
  readonly adelantosRapidos = [0, 50, 100];
  readonly metodosPago = METODOS_PAGO;
  readonly descuentoMaxPct = DESCUENTO_MAX_VENDEDORA_PCT;
  /** Descuento abierto (se esconde por defecto: es la excepción, no la regla). */
  readonly mostrarDescuento = signal(false);

  readonly pasos: { n: Paso; titulo: string; detalle: string; icono: NombreIcono }[] = [
    { n: 1, titulo: "Destino", detalle: "Canal y entrega", icono: "tarifario" },
    { n: 2, titulo: "Productos", detalle: "Arma el pedido", icono: "flor" },
    { n: 3, titulo: "Entrega y pago", detalle: "Cliente, fecha y adelanto", icono: "calendario" },
  ];
  readonly paso = signal<Paso>(1);
  /** Valores del formulario como signals, para que los computed reaccionen. */
  readonly distritoSel = signal("");
  /** En tienda lo normal es que el cliente se lo lleve o lo recoja. */
  readonly tipoEntrega = signal<TipoEntrega>("recojo");
  readonly esRecojo = computed(() => this.tipoEntrega() === "recojo");

  readonly productos = signal<Producto[]>([]);
  readonly distritos = signal<Distrito[]>([]);
  readonly loading = signal(true);
  readonly cotizando = signal(false);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  /** Vista previa del link de Google Maps. */
  readonly ubicacion = signal<Coordenadas | null>(null);
  readonly ubicacionError = signal<string | null>(null);
  readonly resolviendoUbicacion = signal(false);
  private ultimaUbicacionUrl = "";
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

  /** Descuento en soles (0 si no aplica). */
  readonly descuento = computed(() => {
    const v = Number(this.valores().descuento ?? 0);
    return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0;
  });

  /** Tope de descuento para el rol actual (null = sin tope, admin). */
  readonly topeDescuento = computed(() => {
    const r = this.resumen();
    if (!r || this.auth.user()?.rol === "admin") return null;
    return Math.round(((r.subtotalProductos * DESCUENTO_MAX_VENDEDORA_PCT) / 100) * 100) / 100;
  });

  readonly errorDescuento = computed(() => {
    const d = this.descuento();
    if (!d) return null;
    const r = this.resumen();
    const tope = this.topeDescuento();
    if (r && d > r.subtotalProductos) return "No puede ser mayor que los productos.";
    if (tope !== null && d > tope) return `Máximo ${soles(tope)} (${DESCUENTO_MAX_VENDEDORA_PCT} %). Para más, pide al admin.`;
    if (!this.valores().motivoDescuento?.trim()) return "Escribe el motivo.";
    return null;
  });

  readonly totalFinal = computed(() => {
    const r = this.resumen();
    return r ? Math.round((r.total - this.descuento() + Number.EPSILON) * 100) / 100 : 0;
  });

  readonly adelanto = computed(() => {
    const pct = Number(this.valores().porcentajeAdelanto ?? 50);
    return Math.round(((this.totalFinal() * pct) / 100 + Number.EPSILON) * 100) / 100;
  });

  readonly saldo = computed(() => Math.round((this.totalFinal() - this.adelanto() + Number.EPSILON) * 100) / 100);

  /** Texto del botón final: dice exactamente qué va a pasar. */
  readonly textoConfirmar = computed(() => {
    const metodo = this.valores().metodoPago;
    if (this.adelanto() > 0 && metodo && metodo !== "link") {
      return `Cobrar ${soles(this.adelanto())} y crear pedido`;
    }
    return "Confirmar pedido";
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
    ubicacionUrl: [""],
    telefonoReceptor: ["", Validators.required],
    nombreReceptor: ["", Validators.required],
    dedicatoria: [""],
    clienteNombre: ["", Validators.required],
    clienteTelefono: [""],
    porcentajeAdelanto: [100, [Validators.required, Validators.min(0), Validators.max(100)]],
    metodoPago: ["efectivo" as MetodoPagoAhora],
    referenciaPago: [""],
    descuento: [0, [Validators.min(0)]],
    motivoDescuento: [""],
  });

  /** Valores del formulario como signal (los computed de arriba se recalculan al escribir). */
  readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** Campos que solo exige el delivery. */
  private readonly camposDelivery = ["distritoId", "direccion", "telefonoReceptor", "nombreReceptor", "clienteNombre"] as const;

  async ngOnInit(): Promise<void> {
    this.aplicarValidadores();
    this.loading.set(true);
    try {
      const [productos, distritos] = await Promise.all([this.productosService.list(), this.distritosService.list()]);
      // Primero los que ya se pueden vender (tienen precio); luego los que falta configurar.
      this.productos.set(
        productos
          .filter((p) => p.activo)
          .sort((a, b) => Number(this.precioDesde(a) === null) - Number(this.precioDesde(b) === null)),
      );
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
    if (!item.productoId || (!this.esRecojo() && !distritoId)) return;

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
        distritoId: this.esRecojo() ? undefined : distritoId,
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
    if (!this.carrito().length || (!this.esRecojo() && !distritoId)) {
      this.resumen.set(null);
      return;
    }
    this.cotizandoResumen.set(true);
    try {
      this.resumen.set(
        await this.cotizacionesService.cotizarPedido({
          items: this.carrito().map((c) => c.input),
          distritoId: this.esRecojo() ? undefined : distritoId,
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
    if (!r || !r.disponible || this.form.invalid || !this.carrito().length || this.errorDescuento()) {
      this.form.markAllAsTouched();
      if (this.errorDescuento()) this.mostrarDescuento.set(true);
      return;
    }
    const v = this.form.getRawValue();
    const recojo = this.esRecojo();
    const pagaAhora = v.metodoPago !== "link" && this.adelanto() > 0;

    this.enviando.set(true);
    this.error.set(null);
    try {
      const pedido = await this.pedidosService.crear({
        canal: v.canal,
        tipoEntrega: this.tipoEntrega(),
        cliente: { nombre: v.clienteNombre || undefined, telefono: v.clienteTelefono || undefined },
        items: this.carrito().map((c) => c.input),
        fechaEntrega: v.fechaEntrega,
        horaEntrega: v.horaEntrega,
        distritoId: recojo ? undefined : v.distritoId,
        direccion: recojo ? undefined : v.direccion,
        referencia: recojo ? undefined : v.referencia || undefined,
        ubicacionUrl: recojo ? undefined : v.ubicacionUrl.trim() || undefined,
        telefonoReceptor: recojo ? undefined : v.telefonoReceptor,
        nombreReceptor: recojo ? undefined : v.nombreReceptor,
        dedicatoria: v.dedicatoria || undefined,
        porcentajeAdelanto: v.porcentajeAdelanto,
        pagoAhora: pagaAhora
          ? { metodo: v.metodoPago as MetodoCobroDirecto, referencia: v.referenciaPago || undefined }
          : undefined,
        descuento: this.descuento(),
        motivoDescuento: this.descuento() ? v.motivoDescuento : undefined,
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

  /** El evento paste llega antes de que el valor cambie: se lee en el siguiente ciclo. */
  previsualizarUbicacionLuego(): void {
    setTimeout(() => void this.previsualizarUbicacion());
  }

  /** Al pegar o cambiar el link de Google Maps, muestra el mapa (el API abre los links cortos). */
  async previsualizarUbicacion(): Promise<void> {
    const url = this.form.getRawValue().ubicacionUrl.trim();
    if (url === this.ultimaUbicacionUrl) return;
    this.ultimaUbicacionUrl = url;
    this.ubicacion.set(null);
    this.ubicacionError.set(null);
    if (!url) return;
    this.resolviendoUbicacion.set(true);
    try {
      const c = await this.pedidosService.ubicacion(url);
      if (this.ultimaUbicacionUrl === url) this.ubicacion.set(c);
    } catch (err) {
      if (this.ultimaUbicacionUrl === url) this.ubicacionError.set(mensajeError(err, "No se pudo leer el link de Google Maps."));
    } finally {
      if (this.ultimaUbicacionUrl === url) this.resolviendoUbicacion.set(false);
    }
  }

  // ---------- Kiosko: selección por toque ----------

  irAPaso(paso: Paso): void {
    // En tienda, lo más común es que se lo lleve ya: se propone "Ahora".
    if (paso === 3 && this.esRecojo() && !this.form.value.horaEntrega) this.ahora();
    this.paso.set(paso);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  elegirCanal(canal: Canal): void {
    this.form.controls.canal.setValue(canal);
    // Web y WhatsApp casi siempre son delivery; en tienda, recojo.
    void this.elegirEntrega(canal === "vendedora" ? "recojo" : "delivery");
  }

  /** Recoge en tienda / se lo lleva, o delivery. Cambia qué se pide y cómo se cobra. */
  async elegirEntrega(tipo: TipoEntrega): Promise<void> {
    if (this.tipoEntrega() === tipo) return;
    this.tipoEntrega.set(tipo);
    if (tipo === "recojo") {
      this.form.controls.distritoId.setValue("");
      this.distritoSel.set("");
      this.form.patchValue({ porcentajeAdelanto: 100, metodoPago: "efectivo" });
    } else {
      this.form.patchValue({
        porcentajeAdelanto: 50,
        metodoPago: this.form.value.canal === "vendedora" ? "efectivo" : "link",
      });
    }
    this.aplicarValidadores();
    await Promise.all([this.actualizarCotizacion(false), this.actualizarResumen()]);
  }

  /** Los datos de reparto solo son obligatorios en delivery. */
  private aplicarValidadores(): void {
    for (const campo of this.camposDelivery) {
      const c = this.form.controls[campo];
      c.setValidators(this.esRecojo() ? [] : [Validators.required]);
      c.updateValueAndValidity({ emitEvent: false });
    }
    this.form.updateValueAndValidity();
  }

  /** "Se lo lleva": hoy, a esta hora. */
  ahora(): void {
    const hora = new Date().toLocaleTimeString("en-GB", {
      timeZone: "America/Lima",
      hour: "2-digit",
      minute: "2-digit",
    });
    this.form.patchValue({ fechaEntrega: hoyLima(), horaEntrega: hora });
    this.esAhora.set(true);
  }

  /** El cliente se lo lleva en este momento. */
  readonly esAhora = signal(false);

  elegirMetodo(metodo: MetodoPagoAhora): void {
    this.form.controls.metodoPago.setValue(metodo);
  }

  /** Métodos que se ofrecen: en recojo no tiene sentido mandar un link. */
  metodosVisibles() {
    return this.esRecojo() ? this.metodosPago.filter((m) => m.valor !== "link") : this.metodosPago;
  }

  async elegirDistrito(id: string): Promise<void> {
    this.form.controls.distritoId.setValue(id);
    this.distritoSel.set(id);
    await this.onDistritoChange();
  }

  distritoNombre(): string {
    return this.distritos().find((d) => d.id === this.distritoSel())?.nombre ?? "";
  }

  /** Abre el configurador del producto (la "ventana" del kiosko). */
  async abrirProducto(id: string): Promise<void> {
    this.itemForm.reset({ productoId: id, talla: this.primeraTalla(id), cantidad: 1, cambioNoListado: "" });
    await this.onProductoChange();
  }

  @HostListener("document:keydown.escape")
  alPresionarEscape(): void {
    if (this.productoAbierto()) this.cerrarProducto();
  }

  cerrarProducto(): void {
    this.itemForm.reset({ productoId: "", talla: "S", cantidad: 1, cambioNoListado: "" });
    this.cotizacion.set(null);
    this.extraIds.set(new Set());
  }

  productoAbierto(): Producto | null {
    const id = this.itemForm.value.productoId;
    return id ? (this.productos().find((p) => p.id === id) ?? null) : null;
  }

  async elegirTalla(talla: Talla): Promise<void> {
    this.itemForm.controls.talla.setValue(talla);
    await this.onCambioBasico();
  }

  async cambiarCantidad(delta: number): Promise<void> {
    const nueva = Math.max(1, (this.itemForm.value.cantidad ?? 1) + delta);
    this.itemForm.controls.cantidad.setValue(nueva);
    await this.onCambioBasico();
  }

  /** Precio más bajo entre las tallas activas, para la tarjeta "desde S/ …". */
  precioDesde(p: Producto): number | null {
    const precios = p.tallas.filter((t) => t.activo).map((t) => Number(t.precioBase));
    return precios.length ? Math.min(...precios) : null;
  }

  private primeraTalla(productoId: string): Talla {
    const p = this.productos().find((x) => x.id === productoId);
    return this.tallas.find((t) => p?.tallas.some((pt) => pt.talla === t && pt.activo)) ?? "S";
  }

  cantidadEnCarrito(): number {
    return this.carrito().reduce((acc, c) => acc + c.input.cantidad, 0);
  }

  elegirFecha(fecha: string): void {
    this.form.controls.fechaEntrega.setValue(fecha);
    this.esAhora.set(false);
  }

  elegirHora(hora: string): void {
    this.form.controls.horaEntrega.setValue(hora);
    this.esAhora.set(false);
  }

  elegirAdelanto(pct: number): void {
    this.form.controls.porcentajeAdelanto.setValue(pct);
  }

  /** Para pintar los pasos completos en la barra de progreso. */
  pasoListo(paso: Paso): boolean {
    if (paso === 1) return this.esRecojo() || !!this.distritoSel();
    if (paso === 2) return this.carrito().length > 0;
    return this.form.valid;
  }

  opcionTalla(talla: Talla) {
    return this.cotizacion()?.opciones.tallas.find((t) => t.talla === talla);
  }

  invalido(control: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[control];
    return c.invalid && c.touched;
  }
}
