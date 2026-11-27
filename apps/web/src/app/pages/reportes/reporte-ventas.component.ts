import { ChangeDetectionStrategy, Component, ElementRef, computed, input, viewChild } from "@angular/core";
import type { GrupoVentas, ReporteVentas } from "../../core/operacion/operacion.types";
import { soles } from "../../core/util/formato";
import { AreaChartComponent } from "../../shared/charts/area-chart.component";
import { BarChartComponent } from "../../shared/charts/bar-chart.component";
import { DonutChartComponent } from "../../shared/charts/donut-chart.component";
import type { Punto } from "../../shared/charts/escala";
import { descargarExcel } from "../../shared/tabla/excel";
import { imprimirElemento } from "../../shared/tabla/imprimir";
import { MembreteComponent } from "../../shared/tabla/membrete.component";

/**
 * Paleta categórica de marca (validada: banda de claridad, croma, separación
 * para daltonismo ≥ 8 y visión normal ≥ 15). Orden fijo: el color sigue al
 * método, no a su puesto. Amarillo y aqua quedan bajo 3:1, por eso la
 * leyenda siempre muestra nombre, monto y porcentaje.
 */
const PALETA = ["#8a4fa3", "#eb6834", "#1baf7a", "#eda100", "#2a78d6"];
/** Serie única: morado de marca (alto contraste sobre blanco). */
const MORADO = "#6d3f82";

const CANALES: Record<string, string> = {
  vendedora: "En tienda / vendedora",
  whatsapp: "WhatsApp",
  shopify: "Tienda online",
};
const ENTREGAS: Record<string, string> = { delivery: "Delivery", recojo: "Recojo en tienda" };
const METODOS: Record<string, string> = {
  efectivo: "Efectivo",
  yape: "Yape",
  plin: "Plin",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  link: "Link de pago",
  shopify: "Shopify",
};
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

interface Kpi {
  etiqueta: string;
  valor: string;
  /** Variación % contra el período anterior; null si no hay con qué comparar. */
  cambio: number | null;
  nota?: string;
}

/**
 * Reporte de ventas con gráficos, armado como documento: lo mismo que se ve
 * es lo que se imprime o guarda en PDF (A4 horizontal, 2 páginas).
 */
@Component({
  selector: "app-reporte-ventas",
  imports: [MembreteComponent, AreaChartComponent, BarChartComponent, DonutChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "block" },
  template: `
    @let d = datos();
    <article #hoja class="hoja rounded-xl border border-brand-line/80 bg-white px-10 py-9 text-[#3A1F45]">
      <app-membrete [titulo]="titulo()" [periodo]="periodo()" />

      <!-- KPIs -->
      <section class="no-cortar grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 print:grid-cols-6 print:gap-2">
        @for (k of kpis(); track k.etiqueta) {
          <div class="rounded-r-lg border-l-[3px] border-[#b584b9] bg-[#F4EBF7] px-4 py-3">
            <p class="text-[10px] font-medium uppercase tracking-[0.14em] text-[#73607c]">{{ k.etiqueta }}</p>
            <p class="mt-1 font-display text-[20px] font-semibold leading-tight tabular-nums text-[#4e345a] print:text-[17px]">{{ k.valor }}</p>
            @if (k.cambio !== null) {
              <p class="mt-1 text-[11px] font-medium" [class]="k.cambio >= 0 ? 'text-[#1b7a4b]' : 'text-[#b42318]'">
                {{ k.cambio >= 0 ? "▲" : "▼" }} {{ porcentaje(k.cambio) }}
                <span class="font-normal text-[#987f9c]">vs. período anterior</span>
              </p>
            } @else if (k.nota) {
              <p class="mt-1 text-[11px] text-[#987f9c]">{{ k.nota }}</p>
            }
          </div>
        }
      </section>

      <!-- Evolución -->
      <section class="no-cortar mt-8">
        <div class="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 class="font-display text-[15px] font-semibold text-[#4e345a]">{{ d.agrupacion === "mes" ? "Ventas por mes" : "Ventas por día" }}</h2>
            <p class="text-[11px] text-[#987f9c]">Total de los pedidos vendidos (sin cancelados), por fecha de venta.</p>
          </div>
          <p class="text-right text-[11px] text-[#73607c]">
            Mejor {{ d.agrupacion === "mes" ? "mes" : "día" }}:
            <span class="font-semibold text-[#4e345a]">{{ mejor().detalle }} · {{ soles(mejor().valor) }}</span>
          </p>
        </div>
        @if (hayVentas()) {
          <app-area-chart [datos]="serieVentas()" [titulo]="'Ventas en el período'" [alto]="230" [color]="morado" [formato]="soles" />
        } @else {
          <p class="rounded-lg bg-[#faf6fb] py-12 text-center text-[13px] text-[#987f9c]">No hubo ventas en este período.</p>
        }
      </section>

      <p class="mt-6 text-[10px] text-[#987f9c]">
        Período anterior para comparar: {{ fecha(d.anterior.desde) }} al {{ fecha(d.anterior.hasta) }} · ventas {{ soles(d.anterior.ventas) }} en
        {{ d.anterior.pedidos }} {{ d.anterior.pedidos === 1 ? "pedido" : "pedidos" }}. Descuentos otorgados: {{ soles(d.kpis.descuentos) }} · Cancelados:
        {{ d.kpis.cancelados }} ({{ soles(d.kpis.montoCancelado) }}).
      </p>

      <!-- Página 2: desgloses -->
      <div class="salto-antes mt-10 grid gap-x-10 gap-y-9 lg:grid-cols-2 print:mt-0 print:grid-cols-2 print:gap-y-7">
        <section class="no-cortar">
          <h2 class="font-display text-[15px] font-semibold text-[#4e345a]">Cobros por método de pago</h2>
          <p class="mb-3 text-[11px] text-[#987f9c]">Pagos confirmados en el período, por fecha de pago.</p>
          @if (metodos().length) {
            <div class="flex items-center gap-6">
              <app-donut-chart class="w-[190px] shrink-0" [datos]="metodos()" [colores]="paleta" [alto]="190" [formato]="soles" [titulo]="'Cobros por método'">
                <span class="text-[10px] uppercase tracking-[0.14em] text-[#73607c]">Cobrado</span>
                <span class="font-display text-[15px] font-semibold text-[#4e345a]">{{ soles(d.kpis.cobrado) }}</span>
              </app-donut-chart>
              <ul class="min-w-0 flex-1 space-y-2 text-[12px]">
                @for (m of metodos(); track m.etiqueta; let i = $index) {
                  <li class="flex items-center gap-2.5">
                    <span class="h-2.5 w-2.5 shrink-0 rounded-sm" [style.background]="paleta[i]"></span>
                    <span class="flex-1 truncate">{{ m.etiqueta }}</span>
                    <span class="tabular-nums font-medium">{{ soles(m.valor) }}</span>
                    <span class="w-12 text-right tabular-nums text-[#987f9c]">{{ porcentaje((m.valor / d.kpis.cobrado) * 100, false) }}</span>
                  </li>
                }
              </ul>
            </div>
          } @else {
            <p class="py-8 text-center text-[12px] text-[#987f9c]">Sin cobros en el período.</p>
          }
        </section>

        <section class="no-cortar">
          <h2 class="font-display text-[15px] font-semibold text-[#4e345a]">Ventas por día de la semana</h2>
          <p class="mb-3 text-[11px] text-[#987f9c]">Para planificar personal y compras de flores.</p>
          <app-bar-chart [datos]="diasSemana()" [alto]="200" [color]="morado" [enteros]="false" [formato]="soles" [titulo]="'Ventas por día de la semana'" />
        </section>

        <section class="no-cortar">
          <h2 class="font-display text-[15px] font-semibold text-[#4e345a]">Productos más vendidos</h2>
          <p class="mb-3 text-[11px] text-[#987f9c]">Por ingresos; entre paréntesis, las unidades.</p>
          @if (productos().length) {
            <app-bar-chart [datos]="productos()" [horizontal]="true" [alto]="34 + productos().length * 30" [color]="morado" [enteros]="false" [formato]="soles" [titulo]="'Productos más vendidos'" />
          } @else {
            <p class="py-8 text-center text-[12px] text-[#987f9c]">Sin productos vendidos.</p>
          }
        </section>

        <section class="no-cortar space-y-6">
          <div>
            <h2 class="mb-2 font-display text-[15px] font-semibold text-[#4e345a]">Por canal y tipo de entrega</h2>
            <table class="w-full border-collapse text-[12px]">
              <thead>
                <tr class="bg-[#4e345a] text-white">
                  <th class="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em]">Canal / entrega</th>
                  <th class="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em]">Pedidos</th>
                  <th class="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em]">Ventas</th>
                  <th class="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em]">%</th>
                </tr>
              </thead>
              <tbody>
                @for (g of canales(); track g.clave) {
                  <tr class="border-b border-[#ece4ee] even:bg-[#faf6fb]">
                    <td class="px-3 py-1.5" [class]="g.sub ? 'pl-6 text-[#73607c]' : ''">{{ g.clave }}</td>
                    <td class="px-3 py-1.5 text-right tabular-nums">{{ g.pedidos }}</td>
                    <td class="px-3 py-1.5 text-right tabular-nums">{{ soles(g.ventas) }}</td>
                    <td class="px-3 py-1.5 text-right tabular-nums text-[#73607c]">{{ porcentaje(d.kpis.ventas ? (g.ventas / d.kpis.ventas) * 100 : 0, false) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (d.porDistrito.length) {
            <div>
              <h2 class="mb-2 font-display text-[15px] font-semibold text-[#4e345a]">Distritos con más ventas (delivery)</h2>
              <table class="w-full border-collapse text-[12px]">
                <thead>
                  <tr class="bg-[#4e345a] text-white">
                    <th class="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em]">Distrito</th>
                    <th class="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em]">Pedidos</th>
                    <th class="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em]">Ventas</th>
                  </tr>
                </thead>
                <tbody>
                  @for (g of d.porDistrito; track g.clave) {
                    <tr class="border-b border-[#ece4ee] even:bg-[#faf6fb]">
                      <td class="px-3 py-1.5">{{ g.clave }}</td>
                      <td class="px-3 py-1.5 text-right tabular-nums">{{ g.pedidos }}</td>
                      <td class="px-3 py-1.5 text-right tabular-nums">{{ soles(g.ventas) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      </div>

      <footer class="mt-10 flex items-center justify-between gap-4 border-t border-[#ece4ee] pt-3 text-[10px] text-[#987f9c] print:hidden">
        <span class="font-semibold uppercase tracking-[0.18em] text-[#9b73a1]">Mouregal · Flores y Detalles Deluxe</span>
        <span>Documento generado por el ERP</span>
      </footer>
    </article>
  `,
})
export class ReporteVentasComponent {
  readonly datos = input.required<ReporteVentas>();
  readonly titulo = input("Reporte de ventas");
  readonly periodo = input("");

  private readonly hoja = viewChild.required<ElementRef<HTMLElement>>("hoja");

  readonly soles = soles;
  readonly paleta = PALETA;
  readonly morado = MORADO;

  readonly kpis = computed<Kpi[]>(() => {
    const { kpis: k, anterior: a } = this.datos();
    const cambio = (actual: number, previo: number) => (previo > 0 ? ((actual - previo) / previo) * 100 : null);
    const sinBase = "Sin datos del período anterior";
    return [
      { etiqueta: "Ventas", valor: soles(k.ventas), cambio: cambio(k.ventas, a.ventas), nota: sinBase },
      { etiqueta: "Pedidos", valor: String(k.pedidos), cambio: cambio(k.pedidos, a.pedidos), nota: sinBase },
      { etiqueta: "Ticket promedio", valor: soles(k.ticketPromedio), cambio: cambio(k.ticketPromedio, a.ticketPromedio), nota: sinBase },
      { etiqueta: "Cobrado", valor: soles(k.cobrado), cambio: cambio(k.cobrado, a.cobrado), nota: sinBase },
      { etiqueta: "Por cobrar", valor: soles(k.porCobrar), cambio: null, nota: "Saldo de lo vendido" },
      { etiqueta: "Unidades", valor: String(k.unidades), cambio: null, nota: "Productos vendidos" },
    ];
  });

  readonly serieVentas = computed<Punto[]>(() => {
    const porMes = this.datos().agrupacion === "mes";
    return this.datos().serie.map((s) => ({
      etiqueta: porMes ? this.mesCorto(s.fecha) : `${s.fecha.slice(8, 10)}/${s.fecha.slice(5, 7)}`,
      detalle: porMes ? this.mesLargo(s.fecha) : this.diaLargo(s.fecha),
      valor: s.ventas,
    }));
  });

  readonly hayVentas = computed(() => this.datos().kpis.pedidos > 0);

  readonly mejor = computed<Punto>(() =>
    this.serieVentas().reduce((m, p) => (p.valor > m.valor ? p : m), { etiqueta: "", detalle: "—", valor: 0 }),
  );

  /** Hasta 4 métodos con nombre; el resto se agrupa en "Otros" (nunca un 6.º color). */
  readonly metodos = computed<Punto[]>(() => {
    const lista = this.datos().porMetodo.map((m) => ({
      etiqueta: METODOS[m.metodo] ?? m.metodo,
      detalle: `${METODOS[m.metodo] ?? m.metodo} · ${m.cobros} ${m.cobros === 1 ? "cobro" : "cobros"}`,
      valor: m.monto,
    }));
    if (lista.length <= PALETA.length) return lista;
    const otros = lista.slice(PALETA.length - 1).reduce((t, m) => t + m.valor, 0);
    return [...lista.slice(0, PALETA.length - 1), { etiqueta: "Otros", detalle: "Otros métodos", valor: otros }];
  });

  /** Lunes a domingo (la semana de la tienda). */
  readonly diasSemana = computed<Punto[]>(() => {
    const orden = [1, 2, 3, 4, 5, 6, 0];
    const porDia = this.datos().porDiaSemana;
    return orden.map((dia) => {
      const g = porDia.find((p) => p.dia === dia) ?? { pedidos: 0, ventas: 0 };
      return {
        etiqueta: DIAS[dia].slice(0, 3),
        detalle: `${DIAS[dia]} · ${g.pedidos} ${g.pedidos === 1 ? "pedido" : "pedidos"}`,
        valor: g.ventas,
      };
    });
  });

  readonly productos = computed<Punto[]>(() =>
    this.datos().topProductos.map((p) => ({
      etiqueta: `${p.producto.length > 26 ? p.producto.slice(0, 25) + "…" : p.producto} (${p.unidades})`,
      detalle: `${p.producto} · ${p.unidades} ${p.unidades === 1 ? "unidad" : "unidades"}`,
      valor: p.ingresos,
    })),
  );

  /** Canales y, debajo, el tipo de entrega. */
  readonly canales = computed<(GrupoVentas & { sub: boolean })[]>(() => {
    const d = this.datos();
    return [
      ...d.porCanal.map((g) => ({ ...g, clave: CANALES[g.clave] ?? g.clave, sub: false })),
      ...d.porEntrega.map((g) => ({ ...g, clave: ENTREGAS[g.clave] ?? g.clave, sub: true })),
    ];
  });

  porcentaje(v: number, signo = true): string {
    const n = Math.abs(v).toLocaleString("es-PE", { maximumFractionDigits: 1 });
    return signo ? `${n} %` : `${v.toLocaleString("es-PE", { maximumFractionDigits: 1 })} %`;
  }

  fecha(iso: string): string {
    return iso.split("-").reverse().join("/");
  }

  private diaLargo(iso: string): string {
    const d = new Date(`${iso}T12:00:00Z`);
    return `${DIAS[d.getUTCDay()].slice(0, 3).toLowerCase()} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
  }
  private mesCorto(ym: string): string {
    return `${MESES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
  }
  private mesLargo(ym: string): string {
    return `${MESES_LARGOS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
  }

  imprimir(): void {
    imprimirElemento(this.hoja().nativeElement, `${this.titulo()} ${this.periodo()}`.trim());
  }

  /** Excel con la serie (día o mes) y el resumen arriba. */
  descargarExcel(): void {
    const d = this.datos();
    const porMes = d.agrupacion === "mes";
    void descargarExcel(
      "reporte-ventas",
      d.serie.map((s) => ({
        [porMes ? "mes" : "fecha"]: porMes ? this.mesLargo(s.fecha) : `${this.diaLargo(s.fecha)} (${this.fecha(s.fecha)})`,
        pedidos: s.pedidos,
        ventas: s.ventas,
        cobrado: s.cobrado,
      })),
      {
        titulo: this.titulo(),
        periodo: this.periodo(),
        resumen: this.kpis()
          .slice(0, 4)
          .map((k) => ({ etiqueta: k.etiqueta, valor: k.valor })),
        totales: ["pedidos", "ventas", "cobrado"],
      },
    );
  }
}
