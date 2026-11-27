import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AuthService } from "../../core/auth/auth.service";
import { AvisosService } from "../../core/avisos/avisos.service";
import { CajaService, type EstadoCaja } from "../../core/caja/caja.service";
import { mensajeError } from "../../core/http/errores";
import { soles } from "../../core/util/formato";

const METODOS: { valor: string; etiqueta: string }[] = [
  { valor: "yape", etiqueta: "Yape" },
  { valor: "plin", etiqueta: "Plin" },
  { valor: "tarjeta", etiqueta: "Tarjeta" },
  { valor: "transferencia", etiqueta: "Transferencia" },
];

const horaDe = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hour12: false });

/** Caja por vendedora (diseño Mouregal): abrir, registrar egresos y cerrar con el cuadre. */
@Component({
  selector: "app-caja",
  imports: [FormsModule],
  templateUrl: "./caja.component.html",
})
export class CajaComponent implements OnInit {
  private readonly api = inject(CajaService);
  private readonly avisos = inject(AvisosService);
  private readonly auth = inject(AuthService);

  readonly soles = soles;
  readonly hora = horaDe;
  readonly metodos = METODOS;

  readonly estado = signal<EstadoCaja | null>(null);
  readonly cargando = signal(true);
  readonly trabajando = signal(false);
  readonly fondo = signal<string | number>("200");
  readonly movTipo = signal<"egreso" | "ingreso">("egreso");
  readonly movMonto = signal<string | number>("");
  readonly movMotivo = signal("");
  readonly contado = signal<string | number>("");
  readonly nota = signal("");
  readonly cierre = signal<{ diferencia: number; contado: number; esperado: number; nota: string | null } | null>(null);

  readonly nombre = computed(() => this.auth.user()?.nombre?.split(" ")[0] ?? "");
  readonly abierta = computed(() => this.estado()?.abierta ?? null);
  readonly diferencia = computed(() => {
    const a = this.abierta();
    const c = Number(this.contado());
    if (!a || this.contado() === "" || isNaN(c)) return null;
    return Math.round((c - a.efectivoEsperado) * 100) / 100;
  });

  /** Cobros y movimientos en una sola lista, del más reciente al más antiguo. */
  readonly movimientos = computed(() => {
    const a = this.abierta();
    if (!a) return [];
    const efectivo = a.cobros
      .filter((c) => c.metodo === "efectivo")
      .map((c) => ({ id: c.id, at: c.pagadoAt, detalle: `${c.codigo}, cobro en efectivo`, monto: Number(c.monto) }));
    const manuales = a.movimientos.map((m) => ({ id: m.id, at: m.createdAt, detalle: `${m.tipo === "egreso" ? "Egreso" : "Ingreso"}: ${m.motivo}`, monto: m.tipo === "egreso" ? -Number(m.monto) : Number(m.monto) }));
    return [...efectivo, ...manuales, { id: "fondo", at: a.caja.abiertaAt, detalle: "Apertura, fondo inicial", monto: Number(a.caja.fondo) }].sort((x, y) => y.at.localeCompare(x.at));
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    try {
      this.estado.set(await this.api.actual());
    } catch (err) {
      this.avisos.error("No se pudo cargar la caja", mensajeError(err, "Intenta de nuevo."));
    } finally {
      this.cargando.set(false);
    }
  }

  async abrir(): Promise<void> {
    const f = Number(this.fondo());
    if (this.fondo() === "" || isNaN(f) || f < 0) return this.avisos.error("Fondo no válido", "Escribe con cuánto efectivo empiezas.");
    await this.hacer(async () => {
      this.estado.set(await this.api.abrir(f));
      this.cierre.set(null);
      this.avisos.exito("Caja abierta", `Fondo inicial de ${soles(f)}.`);
    });
  }

  async registrarMovimiento(): Promise<void> {
    const m = Number(this.movMonto());
    if (!(m > 0)) return this.avisos.error("Falta el monto", "Escribe cuánto salió o entró de la caja.");
    if (!this.movMotivo().trim()) return this.avisos.error("Falta el motivo", "Anota para qué se usó el dinero.");
    await this.hacer(async () => {
      this.estado.set(await this.api.movimiento(this.movTipo(), m, this.movMotivo().trim()));
      this.avisos.exito(this.movTipo() === "egreso" ? "Egreso registrado" : "Ingreso registrado", `${soles(m)} por ${this.movMotivo().trim().toLowerCase()}.`);
      this.movMonto.set("");
      this.movMotivo.set("");
    });
  }

  async cerrar(): Promise<void> {
    const a = this.abierta();
    const d = this.diferencia();
    if (!a || d === null) return this.avisos.error("Falta el conteo", "Cuenta el efectivo antes de cerrar.");
    if (d !== 0 && !this.nota().trim()) return this.avisos.error("La caja no cuadra", "Explica por qué antes de cerrar.");
    await this.hacer(async () => {
      const r = await this.api.cerrar(Number(this.contado()), this.nota().trim() || undefined);
      this.cierre.set({ diferencia: r.diferencia, contado: Number(r.cerrada.contado), esperado: Number(r.cerrada.esperado), nota: r.cerrada.nota });
      if (r.diferencia === 0) this.avisos.exito("Caja cerrada", "Cuadró exacto.");
      else this.avisos.error("Caja cerrada con diferencia", this.textoDiferencia(r.diferencia));
      this.contado.set("");
      this.nota.set("");
      await this.cargar();
    });
  }

  textoDiferencia(d: number): string {
    return d === 0 ? "Cuadra exacto." : d < 0 ? `Faltan ${soles(-d)} en la caja.` : `Sobran ${soles(d)} en la caja.`;
  }

  private async hacer(fn: () => Promise<void>): Promise<void> {
    this.trabajando.set(true);
    try {
      await fn();
    } catch (err) {
      this.avisos.error("No se guardó", mensajeError(err, "Intenta de nuevo."));
    } finally {
      this.trabajando.set(false);
    }
  }
}
