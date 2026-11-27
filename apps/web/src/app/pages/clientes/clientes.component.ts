import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { AvisosService } from "../../core/avisos/avisos.service";
import { DialogoService } from "../../core/dialogo/dialogo.service";
import { mensajeError } from "../../core/http/errores";
import { ClientesService, type ClienteLista, type FechaProxima, type FichaCliente, type FechaEspecial } from "../../core/pedidos/clientes.service";
import { CLASE_ESTADO_PEDIDO, ETIQUETA_ESTADO_PEDIDO, soles } from "../../core/util/formato";
import { IconComponent } from "../../shared/icon/icon.component";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Clientes (diseño Mouregal): lista con búsqueda y ficha con deuda, fechas especiales e historial. */
@Component({
  selector: "app-clientes",
  imports: [FormsModule, RouterLink, IconComponent],
  templateUrl: "./clientes.component.html",
})
export class ClientesComponent implements OnInit {
  private readonly api = inject(ClientesService);
  private readonly avisos = inject(AvisosService);
  private readonly dialogo = inject(DialogoService);

  readonly soles = soles;
  readonly claseEstado = CLASE_ESTADO_PEDIDO;
  readonly etiquetaEstado = ETIQUETA_ESTADO_PEDIDO;

  readonly q = signal("");
  readonly lista = signal<ClienteLista[]>([]);
  readonly cargando = signal(true);
  readonly sel = signal<string | null>(null);
  readonly ficha = signal<FichaCliente | null>(null);
  readonly cargandoFicha = signal(false);
  readonly proximas = signal<FechaProxima[]>([]);
  readonly nuevaDesc = signal("");
  readonly nuevaFecha = signal("");
  private busquedaTimer: ReturnType<typeof setTimeout> | undefined;

  readonly resumenSemana = computed(() => {
    const p = this.proximas();
    if (!p.length) return "Sin cumpleaños ni aniversarios en los próximos 7 días.";
    const partes = p.slice(0, 3).map((f) => `${f.cliente} (${f.descripcion.toLowerCase()}, ${f.enDias === 0 ? "hoy" : f.enDias === 1 ? "mañana" : `en ${f.enDias} días`})`);
    return `Esta semana: ${partes.join(", ")}${p.length > 3 ? ` y ${p.length - 3} más` : ""}.`;
  });

  async ngOnInit(): Promise<void> {
    void this.api.proximas(7).then((p) => this.proximas.set(p)).catch(() => undefined);
    await this.cargar();
    const primero = this.lista()[0];
    if (primero) await this.elegir(primero.id);
  }

  buscar(v: string): void {
    this.q.set(v);
    clearTimeout(this.busquedaTimer);
    this.busquedaTimer = setTimeout(() => void this.cargar(), 250);
  }

  async cargar(): Promise<void> {
    try {
      this.lista.set(await this.api.list(this.q().trim()));
    } catch (err) {
      this.avisos.error("No se pudieron cargar los clientes", mensajeError(err, "Intenta de nuevo."));
    } finally {
      this.cargando.set(false);
    }
  }

  async elegir(id: string): Promise<void> {
    this.sel.set(id);
    this.cargandoFicha.set(true);
    try {
      this.ficha.set(await this.api.ficha(id));
    } catch (err) {
      this.avisos.error("No se pudo abrir la ficha", mensajeError(err, "Intenta de nuevo."));
    } finally {
      this.cargandoFicha.set(false);
    }
  }

  fecha(f: Pick<FechaEspecial, "dia" | "mes">): string {
    return `${f.dia} de ${MESES[f.mes - 1]}`;
  }

  fechaCorta(f: string): string {
    const [a, m, d] = f.split("-");
    return `${d}/${m}/${a}`;
  }

  desde(iso: string): string {
    const d = new Date(iso);
    return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
  }

  async agregarFecha(): Promise<void> {
    const id = this.sel();
    const m = /^(\d{1,2})\/(\d{1,2})$/.exec(this.nuevaFecha().trim());
    if (!id) return;
    if (this.nuevaDesc().trim().length < 2 || !m) return this.avisos.error("Falta un dato", "Escribe qué se celebra y la fecha como dd/mm.");
    try {
      await this.api.agregarFecha(id, { descripcion: this.nuevaDesc().trim(), dia: Number(m[1]), mes: Number(m[2]) });
      this.avisos.exito("Fecha agregada", `${this.nuevaDesc().trim()}, ${this.fecha({ dia: Number(m[1]), mes: Number(m[2]) })}.`);
      this.nuevaDesc.set("");
      this.nuevaFecha.set("");
      await this.elegir(id);
      void this.api.proximas(7).then((p) => this.proximas.set(p));
    } catch (err) {
      this.avisos.error("No se agregó la fecha", mensajeError(err, "Revisa el día y el mes."));
    }
  }

  async quitarFecha(f: FechaEspecial): Promise<void> {
    const ok = await this.dialogo.confirmar({ titulo: `Quitar «${f.descripcion}»`, detalle: "Ya no se mostrará como fecha especial del cliente.", aceptar: "Quitar fecha", peligro: true });
    if (!ok) return;
    try {
      await this.api.quitarFecha(f.clienteId, f.id);
      this.avisos.exito("Fecha quitada", f.descripcion);
      await this.elegir(f.clienteId);
      void this.api.proximas(7).then((p) => this.proximas.set(p));
    } catch (err) {
      this.avisos.error("No se quitó la fecha", mensajeError(err, "Intenta de nuevo."));
    }
  }

  /** Abre WhatsApp con un mensaje listo para recordarle la fecha al cliente. */
  linkWhatsapp(f: FechaEspecial, c: FichaCliente["cliente"]): string | null {
    const tel = (c.telefono ?? "").replace(/\D/g, "");
    if (!tel) return null;
    const texto = `Hola ${c.nombre.split(" ")[0]}, se acerca ${f.descripcion.toLowerCase()} (${this.fecha(f)}). ¿Te ayudamos con unas flores? Mouregal`;
    return `https://wa.me/51${tel.slice(-9)}?text=${encodeURIComponent(texto)}`;
  }
}
