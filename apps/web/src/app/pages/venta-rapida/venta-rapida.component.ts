import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import type { Talla } from "@erp/shared";
import { AvisosService } from "../../core/avisos/avisos.service";
import { ProductosService } from "../../core/catalogo/productos.service";
import type { Producto } from "../../core/catalogo/catalogo.types";
import { mensajeError } from "../../core/http/errores";
import { CotizacionesService, PedidosService } from "../../core/pedidos/pedidos.service";
import type { ResultadoCotizacionPedido } from "../../core/pedidos/pedidos.types";
import { soles } from "../../core/util/formato";
import { IconComponent } from "../../shared/icon/icon.component";

type Metodo = "efectivo" | "yape" | "plin" | "tarjeta";
interface Linea {
  productoId: string;
  nombre: string;
  talla: Talla;
  precio: number;
  cantidad: number;
  florId: string;
  papelId: string | null;
}

/**
 * Venta rápida de mostrador (diseño Mouregal): el arreglo ya está armado en la
 * vitrina. Se cobra todo y queda entregado; el stock se descuenta por receta.
 */
@Component({
  selector: "app-venta-rapida",
  imports: [FormsModule, RouterLink, IconComponent],
  templateUrl: "./venta-rapida.component.html",
})
export class VentaRapidaComponent implements OnInit {
  private readonly productosApi = inject(ProductosService);
  private readonly pedidosApi = inject(PedidosService);
  private readonly cotizador = inject(CotizacionesService);
  private readonly avisos = inject(AvisosService);

  readonly soles = soles;
  readonly metodos: { valor: Metodo; etiqueta: string }[] = [
    { valor: "efectivo", etiqueta: "Efectivo" },
    { valor: "yape", etiqueta: "Yape" },
    { valor: "plin", etiqueta: "Plin" },
    { valor: "tarjeta", etiqueta: "Tarjeta" },
  ];

  readonly productos = signal<Producto[]>([]);
  readonly cargando = signal(true);
  readonly carrito = signal<Linea[]>([]);
  readonly cotizacion = signal<ResultadoCotizacionPedido | null>(null);
  readonly metodo = signal<Metodo>("efectivo");
  readonly pagaCon = signal<string>("");
  readonly operacion = signal("");
  readonly clienteNombre = signal("");
  readonly clienteTelefono = signal("");
  readonly vendiendo = signal(false);
  readonly error = signal<string | null>(null);
  /** Talla elegida por producto en la vitrina (por defecto la primera activa). */
  readonly tallaDe = signal<Record<string, Talla>>({});

  readonly total = computed(() => this.cotizacion()?.total ?? this.carrito().reduce((a, l) => a + l.precio * l.cantidad, 0));
  readonly vuelto = computed(() => {
    const p = Number(this.pagaCon());
    if (!this.pagaCon() || isNaN(p)) return null;
    return Math.round((p - this.total()) * 100) / 100;
  });
  readonly faltan = computed(() => (this.cotizacion()?.faltantes ?? []).map((f) => f.nombre).join(", "));
  readonly necesitaOperacion = computed(() => this.metodo() === "yape" || this.metodo() === "plin");

  async ngOnInit(): Promise<void> {
    try {
      this.productos.set((await this.productosApi.list()).filter((p) => p.activo && p.tallas.some((t) => t.activo)));
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudo cargar el catálogo."));
    } finally {
      this.cargando.set(false);
    }
  }

  tallas(p: Producto) {
    return p.tallas.filter((t) => t.activo);
  }

  talla(p: Producto): Talla {
    return this.tallaDe()[p.id] ?? this.tallas(p)[0].talla;
  }

  precio(p: Producto): number {
    return Number(this.tallas(p).find((t) => t.talla === this.talla(p))?.precioBase ?? 0);
  }

  elegirTalla(p: Producto, t: Talla): void {
    this.tallaDe.update((m) => ({ ...m, [p.id]: t }));
  }

  agregar(p: Producto): void {
    const talla = this.talla(p);
    this.carrito.update((c) => {
      const i = c.findIndex((l) => l.productoId === p.id && l.talla === talla);
      if (i >= 0) return c.map((l, j) => (j === i ? { ...l, cantidad: l.cantidad + 1 } : l));
      return [...c, { productoId: p.id, nombre: p.nombre, talla, precio: this.precio(p), cantidad: 1, florId: p.florPrincipalId, papelId: p.papelDefaultId }];
    });
    void this.cotizar();
  }

  quitar(l: Linea): void {
    this.carrito.update((c) => c.flatMap((x) => (x === l ? (x.cantidad > 1 ? [{ ...x, cantidad: x.cantidad - 1 }] : []) : [x])));
    void this.cotizar();
  }

  /** Precio real y stock disponible (lo vendido por otras vendedoras incluido). */
  private async cotizar(): Promise<void> {
    const c = this.carrito();
    if (!c.length) return this.cotizacion.set(null);
    try {
      this.cotizacion.set(await this.cotizador.cotizarPedido({ items: this.items() } as never));
    } catch {
      this.cotizacion.set(null);
    }
  }

  private items() {
    return this.carrito().map((l) => ({ productoId: l.productoId, talla: l.talla, cantidad: l.cantidad, florId: l.florId, papelId: l.papelId, extraIds: [] as string[] }));
  }

  async vender(): Promise<void> {
    const total = this.total();
    if (!this.carrito().length) return this.fallo("No hay nada para cobrar", "Agrega al menos un arreglo de la vitrina.");
    if (this.cotizacion() && !this.cotizacion()!.disponible) return this.fallo("Sin stock suficiente", this.cotizacion()!.faltantes.map((f) => f.nombre).join(", "));
    const v = this.vuelto();
    if (this.metodo() === "efectivo" && v !== null && v < 0) return this.fallo("No alcanza", `Faltan ${soles(-v)}.`);
    if (this.necesitaOperacion() && !this.operacion().trim()) return this.fallo("Falta el número de operación", "Pídelo en la pantalla del celular del cliente.");
    this.vendiendo.set(true);
    this.error.set(null);
    try {
      const p = await this.pedidosApi.ventaRapida({
        items: this.items(),
        pagos: [{ metodo: this.metodo(), monto: total, referencia: this.operacion().trim() || undefined }],
        cliente: { nombre: this.clienteNombre().trim() || undefined, telefono: this.clienteTelefono().trim() || undefined },
      });
      this.avisos.exito(`Venta ${p.codigo} entregada`, `${soles(total)} en ${this.metodo()}${this.metodo() === "efectivo" && v !== null ? `, vuelto ${soles(v)}` : ""}.`);
      this.carrito.set([]);
      this.cotizacion.set(null);
      this.pagaCon.set("");
      this.operacion.set("");
      this.clienteNombre.set("");
      this.clienteTelefono.set("");
    } catch (err) {
      const m = mensajeError(err, "No se pudo registrar la venta.");
      this.error.set(m);
      this.avisos.error("No se registró la venta", m);
    } finally {
      this.vendiendo.set(false);
    }
  }

  private fallo(titulo: string, detalle: string): void {
    this.error.set(`${titulo}. ${detalle}`);
    this.avisos.error(titulo, detalle);
  }
}
