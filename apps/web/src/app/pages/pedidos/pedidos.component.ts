import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import type { Canal, EstadoPedido } from "@erp/shared";
import { mensajeError } from "../../core/http/errores";
import { PedidosService, UsuariosService, type Usuario } from "../../core/pedidos/pedidos.service";
import type { PedidoLista } from "../../core/pedidos/pedidos.types";
import { CLASE_ESTADO_PEDIDO, ETIQUETA_ESTADO_PEDIDO, diasDesdeHoy, hora, hoyLima, soles } from "../../core/util/formato";
import { IconComponent } from "../../shared/icon/icon.component";
import { RowMenuComponent } from "../../shared/tabla/row-menu.component";
import { Tabla } from "../../shared/tabla/tabla";
import { TABLA_CONTROLES } from "../../shared/tabla/tabla-controles.component";

const ESTADOS: EstadoPedido[] = ["pendiente", "en_armado", "listo", "en_camino", "entregado", "cancelado"];
const CANALES: Record<Canal, string> = { vendedora: "En tienda", whatsapp: "WhatsApp", shopify: "Web (Shopify)" };
type Rango = "hoy-manana" | "hoy" | "ayer" | "7" | "mes" | "todo";
const RANGOS: { valor: Rango; etiqueta: string }[] = [
  { valor: "hoy-manana", etiqueta: "Hoy y mañana" },
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: "ayer", etiqueta: "Ayer" },
  { valor: "7", etiqueta: "Últimos 7 días" },
  { valor: "mes", etiqueta: "Este mes" },
  { valor: "todo", etiqueta: "Todas las fechas" },
];

/** Todos los pedidos: historial completo con búsqueda y filtros (diseño Mouregal). */
@Component({
  selector: "app-pedidos",
  imports: [FormsModule, RouterLink, IconComponent, RowMenuComponent, ...TABLA_CONTROLES],
  templateUrl: "./pedidos.component.html",
})
export class PedidosComponent implements OnInit {
  private readonly api = inject(PedidosService);
  private readonly usuariosApi = inject(UsuariosService);
  private readonly ruta = inject(ActivatedRoute);

  readonly soles = soles;
  readonly hora = hora;
  readonly claseEstado = CLASE_ESTADO_PEDIDO;
  readonly etiquetaEstado = ETIQUETA_ESTADO_PEDIDO;
  readonly canales = CANALES;
  readonly listaCanales = Object.entries(CANALES) as [Canal, string][];
  readonly estados = ESTADOS;
  readonly rangos = RANGOS;

  readonly pedidos = signal<PedidoLista[]>([]);
  readonly vendedoras = signal<Usuario[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly q = signal("");
  readonly rango = signal<Rango>("todo");
  readonly canal = signal<Canal | "">("");
  readonly vendedora = signal("");
  readonly estado = signal<EstadoPedido | null>(null);

  /** Lo que pide el servidor (fechas, canal, vendedora). El estado y el texto se filtran aquí. */
  private readonly consulta = computed(() => {
    const hoy = hoyLima();
    const r = this.rango();
    const rango =
      r === "hoy" ? { desde: hoy, hasta: hoy }
      : r === "ayer" ? { desde: diasDesdeHoy(-1), hasta: diasDesdeHoy(-1) }
      : r === "hoy-manana" ? { desde: hoy, hasta: diasDesdeHoy(1) }
      : r === "7" ? { desde: diasDesdeHoy(-7), hasta: hoy }
      : r === "mes" ? { desde: hoy.slice(0, 8) + "01", hasta: hoy.slice(0, 8) + "31" }
      : {};
    return { ...rango, canal: this.canal() || undefined, creadoPor: this.vendedora() || undefined };
  });

  /** Pedidos que pasan la búsqueda de texto (base de los contadores de las pestañas). */
  private readonly porTexto = computed(() => {
    const q = this.q().trim().toLowerCase().replace(/^#/, "").replace(/\s/g, "");
    if (!q) return this.pedidos();
    return this.pedidos().filter((p) =>
      [p.codigo, p.cliente, p.telefonoCliente, p.nombreReceptor, p.distrito, p.resumen]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .replace(/\s/g, "")
        .includes(q),
    );
  });

  readonly filtrados = computed(() => {
    const e = this.estado();
    return e ? this.porTexto().filter((p) => p.estado === e) : this.porTexto();
  });

  readonly porCobrar = computed(() => this.filtrados().reduce((a, p) => a + this.saldo(p), 0));

  readonly tabla = new Tabla(() => this.filtrados(), {
    id: (p) => p.id,
    porPagina: 15,
    nombreCsv: "pedidos",
    titulo: "Todos los pedidos",
    totales: ["total", "debe"],
    csv: (p) => ({
      pedido: p.codigo,
      cliente: p.cliente,
      telefono: p.telefonoCliente,
      arreglo: p.resumen,
      entrega: `${p.fechaEntrega} ${hora(p.horaEntrega)}`,
      destino: p.tipoEntrega === "recojo" ? "Recoge en tienda" : p.distrito,
      canal: CANALES[p.canal],
      vendedora: p.vendedora,
      estado: ETIQUETA_ESTADO_PEDIDO[p.estado],
      total: Number(p.total),
      debe: this.saldo(p),
    }),
  });

  async ngOnInit(): Promise<void> {
    const q = this.ruta.snapshot.queryParamMap.get("q");
    if (q) this.q.set(q);
    void this.usuariosApi.list("vendedora").then((u) => this.vendedoras.set(u)).catch(() => undefined);
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.pedidos.set(await this.api.listar(this.consulta()));
      this.error.set(null);
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudieron cargar los pedidos."));
    } finally {
      this.cargando.set(false);
    }
  }

  cambiar<T>(s: { set: (v: T) => void }, v: T): void {
    s.set(v);
    void this.cargar();
  }

  conteo(e: EstadoPedido | null): number {
    return e ? this.porTexto().filter((p) => p.estado === e).length : this.porTexto().length;
  }

  quitarFiltros(): void {
    this.q.set("");
    this.estado.set(null);
    this.canal.set("");
    this.vendedora.set("");
    this.rango.set("todo");
    void this.cargar();
  }

  saldo(p: PedidoLista): number {
    if (p.estado === "cancelado") return 0;
    return Math.max(0, Math.round((Number(p.total) - Number(p.totalPagado)) * 100) / 100);
  }

  fecha(f: string): string {
    const [a, m, d] = f.split("-");
    return `${d}/${m}/${a}`;
  }
}
