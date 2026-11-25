import { Component, OnInit, computed, inject, signal, viewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { mensajeError } from "../../core/http/errores";
import { ReportesApi } from "../../core/operacion/operacion.service";
import type {
  ReporteCobros,
  ReporteEnvios,
  ReporteMargen,
  ReporteMasVendidos,
  ReporteMerma,
  ReporteVentas,
} from "../../core/operacion/operacion.types";
import { RouterLink } from "@angular/router";
import { ETIQUETA_ESTADO_PEDIDO, cantidad, diasDesdeHoy, hoyLima, soles } from "../../core/util/formato";
import { BarChartComponent } from "../../shared/charts/bar-chart.component";
import type { Punto } from "../../shared/charts/escala";
import { Tabla } from "../../shared/tabla/tabla";
import { TABLA_CONTROLES } from "../../shared/tabla/tabla-controles.component";
import { IconComponent } from "../../shared/icon/icon.component";
import { ReporteVentasComponent } from "./reporte-ventas.component";
import { VistaPreviaComponent, type DatoResumen } from "../../shared/tabla/vista-previa.component";

type Pestana = "resumen" | "cobros" | "margen" | "merma" | "vendidos" | "envios";

@Component({
  selector: "app-reportes",
  imports: [FormsModule, RouterLink, BarChartComponent, ReporteVentasComponent, IconComponent, VistaPreviaComponent, ...TABLA_CONTROLES],
  templateUrl: "./reportes.component.html",
})
export class ReportesComponent implements OnInit {
  private readonly api = inject(ReportesApi);

  readonly soles = soles;
  readonly cantidad = cantidad;
  readonly pestanas: { id: Pestana; label: string }[] = [
    { id: "resumen", label: "Resumen de ventas" },
    { id: "cobros", label: "Cobros" },
    { id: "margen", label: "Margen" },
    { id: "merma", label: "Merma" },
    { id: "vendidos", label: "Más vendidos" },
    { id: "envios", label: "Envíos" },
  ];
  readonly atajos = [
    { label: "7 días", dias: 7 },
    { label: "30 días", dias: 30 },
    { label: "90 días", dias: 90 },
  ];

  readonly pestana = signal<Pestana>("resumen");
  readonly desde = signal(`${hoyLima().slice(0, 8)}01`);
  readonly hasta = signal(hoyLima());
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly ventas = signal<ReporteVentas | null>(null);
  readonly reporteVentas = viewChild(ReporteVentasComponent);
  readonly margen = signal<ReporteMargen | null>(null);
  readonly merma = signal<ReporteMerma | null>(null);
  readonly vendidos = signal<ReporteMasVendidos | null>(null);
  readonly envios = signal<ReporteEnvios | null>(null);
  readonly cobros = signal<ReporteCobros | null>(null);
  readonly etiquetaEstado = ETIQUETA_ESTADO_PEDIDO;

  /** Atajo de período elegido (solo para marcar la pestaña activa). */
  readonly atajo = signal<number | "mes" | "mesPasado" | "anio" | null>("mes");

  readonly tablaMargen = new Tabla(() => this.margen()?.filas ?? [], {
    id: (f) => `${f.producto}|${f.talla}`,
    porPagina: 10,
    nombreCsv: "reporte-margen",
    totales: ["unidades", "ingresos", "costo", "margen"],
    csv: (f) => ({ producto: f.producto, talla: f.talla, unidades: f.unidades, ingresos: f.ingresos, costo: f.costo, margen: f.margen, margenPct: f.margenPct }),
  });
  readonly tablaMerma = new Tabla(() => this.merma()?.filas ?? [], {
    id: (f) => f.insumoId,
    porPagina: 10,
    nombreCsv: "reporte-merma",
    totales: ["valorProduccion", "valorCancelacion", "valorTotal"],
    csv: (f) => ({
      codigo: f.codigo,
      insumo: f.nombre,
      unidad: f.unidadBase,
      mermaProduccion: f.cantidadProduccion,
      valorProduccion: f.valorProduccion,
      mermaCancelacion: f.cantidadCancelacion,
      valorCancelacion: f.valorCancelacion,
      valorTotal: f.valorTotal,
    }),
  });
  readonly tablaVendidos = new Tabla(() => this.vendidos()?.filas ?? [], {
    id: (f) => `${f.producto}|${f.talla}`,
    porPagina: 10,
    nombreCsv: "reporte-mas-vendidos",
    totales: ["unidades", "pedidos", "ingresos"],
    csv: (f) => ({ producto: f.producto, talla: f.talla, unidades: f.unidades, pedidos: f.pedidos, ingresos: f.ingresos }),
  });
  readonly tablaEnvios = new Tabla(() => this.envios()?.filas ?? [], {
    id: (f) => `${f.distrito}|${f.vehiculo}`,
    porPagina: 10,
    nombreCsv: "reporte-envios",
    totales: ["viajes", "cobrado", "costo", "diferencia"],
    csv: (f) => ({ distrito: f.distrito, vehiculo: f.vehiculo, viajes: f.viajes, cobrado: f.cobrado, costo: f.costo, diferencia: f.diferencia }),
  });

  readonly tablaCobros = new Tabla(() => this.cobros()?.filas ?? [], {
    id: (f) => f.pagoId,
    porPagina: 15,
    nombreCsv: "reporte-cobros",
    totales: ["monto"],
    csv: (f) => ({
      fecha: this.fechaHora(f.pagadoAt),
      pedido: f.codigo,
      cliente: f.cliente,
      tipo: f.tipo,
      metodo: f.metodo,
      monto: f.monto,
      estadoPedido: ETIQUETA_ESTADO_PEDIDO[f.estadoPedido],
    }),
  });

  /** "09/11 17:01" en hora de Lima. */
  fechaHora(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-PE", {
      timeZone: "America/Lima",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  readonly mostrarPrevia = signal(false);

  /** Rango legible para la cabecera del documento: "01/11/2026 al 23/11/2026". */
  readonly periodoTexto = computed(() => {
    const f = (d: string) => d.split("-").reverse().join("/");
    return `Del ${f(this.desde())} al ${f(this.hasta())}`;
  });

  /** Tabla, título y totales de la pestaña activa, para la vista previa (Excel / PDF). */
  readonly previa = computed<{ tabla: Tabla<unknown>; titulo: string; resumen: DatoResumen[] }>(() => {
    switch (this.pestana()) {
      case "resumen":
      case "cobros": {
        const c = this.cobros();
        return {
          tabla: this.tablaCobros as Tabla<unknown>,
          titulo: "Reporte de cobros",
          resumen: c
            ? [{ etiqueta: "Total cobrado", valor: soles(c.totales.monto) }, ...c.porMetodo.map((m) => ({ etiqueta: m.metodo.charAt(0).toUpperCase() + m.metodo.slice(1), valor: soles(m.monto) }))]
            : [],
        };
      }
      case "margen": {
        const t = this.margen()?.totales;
        return {
          tabla: this.tablaMargen as Tabla<unknown>,
          titulo: "Reporte de margen por producto y talla",
          resumen: t
            ? [
                { etiqueta: "Ingresos", valor: soles(t.ingresos) },
                { etiqueta: "Costo", valor: soles(t.costo) },
                { etiqueta: "Margen", valor: soles(t.margen) },
                { etiqueta: "Margen %", valor: `${t.margenPct}%` },
              ]
            : [],
        };
      }
      case "merma": {
        const t = this.merma()?.totales;
        return {
          tabla: this.tablaMerma as Tabla<unknown>,
          titulo: "Reporte de merma por insumo",
          resumen: t
            ? [
                { etiqueta: "Merma de producción", valor: soles(t.valorProduccion) },
                { etiqueta: "Merma por cancelación", valor: soles(t.valorCancelacion) },
                { etiqueta: "Merma total", valor: soles(t.valorTotal) },
              ]
            : [],
        };
      }
      case "vendidos": {
        const filas = this.vendidos()?.filas ?? [];
        return {
          tabla: this.tablaVendidos as Tabla<unknown>,
          titulo: "Productos más vendidos",
          resumen: filas.length
            ? [
                { etiqueta: "Unidades", valor: String(filas.reduce((t, f) => t + f.unidades, 0)) },
                { etiqueta: "Ingresos", valor: soles(filas.reduce((t, f) => t + f.ingresos, 0)) },
              ]
            : [],
        };
      }
      case "envios": {
        const t = this.envios()?.totales;
        return {
          tabla: this.tablaEnvios as Tabla<unknown>,
          titulo: "Envíos por distrito y vehículo",
          resumen: t
            ? [
                { etiqueta: "Viajes", valor: String(t.viajes) },
                { etiqueta: "Cobrado", valor: soles(t.cobrado) },
                { etiqueta: "Costo", valor: soles(t.costo) },
                { etiqueta: "Diferencia", valor: soles(t.diferencia) },
              ]
            : [],
        };
      }
    }
  });

  protected readonly Math = Math;
  readonly formatoUnidades = (v: number) => `${v} und.`;

  /** Top 10 para el ranking horizontal (la tabla de abajo tiene todos). */
  readonly topVendidos = computed<Punto[]>(() =>
    (this.vendidos()?.filas ?? []).slice(0, 10).map((f) => ({
      etiqueta: `${f.producto} ${f.talla}`,
      detalle: `${f.producto} talla ${f.talla} · ${f.pedidos} pedidos · ${soles(f.ingresos)}`,
      valor: f.unidades,
    })),
  );

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async usarAtajo(dias: number): Promise<void> {
    this.atajo.set(dias);
    this.desde.set(diasDesdeHoy(-(dias - 1)));
    this.hasta.set(hoyLima());
    await this.cargar();
  }

  async mesActual(): Promise<void> {
    this.atajo.set("mes");
    this.desde.set(`${hoyLima().slice(0, 8)}01`);
    this.hasta.set(hoyLima());
    await this.cargar();
  }

  async mesPasado(): Promise<void> {
    const [a, m] = hoyLima().split("-").map(Number);
    const anio = m === 1 ? a - 1 : a;
    const mes = m === 1 ? 12 : m - 1;
    const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    const mm = String(mes).padStart(2, "0");
    this.atajo.set("mesPasado");
    this.desde.set(`${anio}-${mm}-01`);
    this.hasta.set(`${anio}-${mm}-${ultimo}`);
    await this.cargar();
  }

  async anioActual(): Promise<void> {
    this.atajo.set("anio");
    this.desde.set(`${hoyLima().slice(0, 4)}-01-01`);
    this.hasta.set(hoyLima());
    await this.cargar();
  }

  /** "Reporte de ventas · Noviembre 2026" si el rango es un mes; "· 2026" si es el año. */
  readonly tituloVentas = computed(() => {
    const d = this.desde();
    const h = this.hasta();
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const finDeMes = (f: string) => new Date(Date.UTC(+f.slice(0, 4), +f.slice(5, 7), 0)).getUTCDate() === +f.slice(8, 10);
    const llegaHoy = h === hoyLima();
    if (d.endsWith("-01-01") && d.slice(0, 4) === h.slice(0, 4) && h.slice(5, 7) !== "01" && (h.endsWith("-12-31") || llegaHoy))
      return `Reporte de ventas · ${d.slice(0, 4)}`;
    if (d.endsWith("-01") && d.slice(0, 7) === h.slice(0, 7) && (finDeMes(h) || llegaHoy))
      return `Reporte de ventas · ${meses[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
    return "Reporte de ventas";
  });

  async cargar(): Promise<void> {
    if (!this.desde() || !this.hasta()) return;
    if (this.desde() > this.hasta()) {
      this.error.set("La fecha 'desde' debe ser anterior o igual a 'hasta'.");
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const r = { desde: this.desde(), hasta: this.hasta() };
    try {
      const [ventas, margen, merma, vendidos, envios, cobros] = await Promise.all([
        this.api.ventas(r),
        this.api.margen(r),
        this.api.merma(r),
        this.api.masVendidos(r),
        this.api.envios(r),
        this.api.cobros(r),
      ]);
      this.ventas.set(ventas);
      this.margen.set(margen);
      this.merma.set(merma);
      this.vendidos.set(vendidos);
      this.envios.set(envios);
      this.cobros.set(cobros);
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudieron cargar los reportes."));
    } finally {
      this.loading.set(false);
    }
  }

}
