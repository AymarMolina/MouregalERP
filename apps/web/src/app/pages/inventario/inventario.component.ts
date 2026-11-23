import { DatePipe } from "@angular/common";
import { IconComponent } from "../../shared/icon/icon.component";
import { RowMenuComponent } from "../../shared/tabla/row-menu.component";
import { Tabla } from "../../shared/tabla/tabla";
import { TABLA_CONTROLES } from "../../shared/tabla/tabla-controles.component";
import { Component, HostListener, OnInit, computed, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import type { InsumoCategoria, UnidadBase } from "@erp/shared";
import { INSUMO_CATEGORIA, UNIDAD_BASE } from "@erp/shared";
import { cantidad, soles } from "../../core/util/formato";
import type { Insumo } from "../../core/catalogo/catalogo.types";
import { InsumosService, type KardexMovimiento } from "../../core/catalogo/insumos.service";

@Component({
  selector: "app-inventario",
  imports: [ReactiveFormsModule, DatePipe, IconComponent, RouterLink, RowMenuComponent, ...TABLA_CONTROLES],
  templateUrl: "./inventario.component.html",
})
export class InventarioComponent implements OnInit {
  private readonly insumosService = inject(InsumosService);
  private readonly fb = inject(FormBuilder);

  readonly categorias: InsumoCategoria[] = [...INSUMO_CATEGORIA];
  readonly unidades: UnidadBase[] = [...UNIDAD_BASE];
  readonly cantidad = cantidad;
  readonly soles = soles;
  /** Costo unitario: 2 a 4 decimales (los insumos por gramo cuestan céntimos). */
  costo(valor: string | number): string {
    return `S/ ${Number(valor).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  }

  readonly insumos = signal<Insumo[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly mostrarForm = signal(false);
  readonly aperturaMensaje = signal<string | null>(null);
  readonly aperturaErrores = signal<string[]>([]);
  readonly kardexDe = signal<Insumo | null>(null);
  readonly kardexMovimientos = signal<KardexMovimiento[]>([]);
  readonly cargandoKardex = signal(false);

  readonly form = this.fb.nonNullable.group({
    codigo: ["", Validators.required],
    nombre: ["", Validators.required],
    categoria: ["flor" as InsumoCategoria, Validators.required],
    unidadBase: ["tallo" as UnidadBase, Validators.required],
    stockMinimo: [0, [Validators.required, Validators.min(0)]],
    esFlor: [false],
    esCaja: [false],
  });

  readonly editForm = this.fb.nonNullable.group({
    nombre: ["", Validators.required],
    stockMinimo: [0, [Validators.required, Validators.min(0)]],
    activo: [true],
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  stockBajo(insumo: Insumo): boolean {
    return this.estadoStock(insumo) !== "ok";
  }

  /** agotado: sin stock · bajo: por debajo del mínimo · ok: en o sobre el mínimo. */
  estadoStock(insumo: Insumo): "agotado" | "bajo" | "ok" {
    const stock = Number(insumo.stockActual);
    if (stock <= 0) return "agotado";
    return stock < Number(insumo.stockMinimo) ? "bajo" : "ok";
  }

  /** "tallo" → "tallos" según la cantidad; g y m no cambian. */
  unidad(u: string, n: number | string): string {
    if (Number(n) === 1) return u === "und" ? "unidad" : u;
    return ({ tallo: "tallos", hoja: "hojas", und: "unidades" } as Record<string, string>)[u] ?? u;
  }

  /** Cuánto falta para llegar al stock mínimo. */
  faltaParaMinimo(insumo: Insumo): number {
    return Math.max(0, Number(insumo.stockMinimo) - Number(insumo.stockActual));
  }

  /** "todos" o solo los que necesitan reposición. */
  readonly filtroStock = signal<"todos" | "alerta">("todos");

  alternarFiltroStock(): void {
    this.filtroStock.set(this.filtroStock() === "alerta" ? "todos" : "alerta");
  }

  readonly resumenStock = computed(() => {
    const lista = this.insumos().filter((i) => i.activo);
    const agotados = lista.filter((i) => this.estadoStock(i) === "agotado").length;
    const bajos = lista.filter((i) => this.estadoStock(i) === "bajo").length;
    return { agotados, bajos, total: agotados + bajos };
  });

  readonly insumosVisibles = computed(() => {
    if (this.filtroStock() === "todos") return this.insumos();
    const peso = { agotado: 0, bajo: 1, ok: 2 } as const;
    return this.insumos()
      .filter((i) => this.estadoStock(i) !== "ok")
      .sort((a, b) => peso[this.estadoStock(a)] - peso[this.estadoStock(b)]);
  });

  readonly tabla = new Tabla(() => this.insumosVisibles(), {
    id: (i) => i.id,
    porPagina: 15,
    nombreCsv: "insumos",
    csv: (i) => ({
      codigo: i.codigo,
      nombre: i.nombre,
      categoria: i.categoria,
      unidad: i.unidadBase,
      minimo: i.stockMinimo,
      stock: i.stockActual,
      costo_promedio: i.costoPromedio,
      activo: i.activo ? "Sí" : "No",
    }),
  });

  /** Etiqueta y color de cada tipo de movimiento (verde entra, rojo pierde, azul consumo). */
  readonly tipoKardex: Record<string, { etiqueta: string; clase: string }> = {
    apertura: { etiqueta: "Apertura", clase: "bg-estado-pendiente-bg text-estado-pendiente-fg" },
    compra: { etiqueta: "Compra", clase: "bg-estado-listo-bg text-estado-listo-fg" },
    devolucion: { etiqueta: "Devolución", clase: "bg-estado-listo-bg text-estado-listo-fg" },
    ajuste_positivo: { etiqueta: "Ajuste +", clase: "bg-estado-listo-bg text-estado-listo-fg" },
    consumo: { etiqueta: "Consumo", clase: "bg-estado-en-camino-bg text-estado-en-camino-fg" },
    merma: { etiqueta: "Merma", clase: "bg-red-50 text-red-700" },
    ajuste_negativo: { etiqueta: "Ajuste −", clase: "bg-red-50 text-red-700" },
  };

  readonly filtroKardex = signal<"todos" | "entradas" | "salidas">("todos");

  readonly kardexVisibles = computed(() => {
    const f = this.filtroKardex();
    if (f === "todos") return this.kardexMovimientos();
    return this.kardexMovimientos().filter((m) => Number(f === "entradas" ? m.entrada : m.salida) > 0);
  });

  readonly resumenKardex = computed(() => {
    const movs = this.kardexMovimientos();
    const insumo = this.kardexDe();
    return {
      entradas: movs.reduce((t, m) => t + Number(m.entrada), 0),
      salidas: movs.reduce((t, m) => t + Number(m.salida), 0),
      nEntradas: movs.filter((m) => Number(m.entrada) > 0).length,
      nSalidas: movs.filter((m) => Number(m.salida) > 0).length,
      valor: insumo ? Number(insumo.stockActual) * Number(insumo.costoPromedio) : 0,
    };
  });

  readonly tablaKardex = new Tabla(() => this.kardexVisibles(), {
    id: (m) => m.id,
    porPagina: 10,
    nombreCsv: "kardex",
    csv: (m) => ({
      fecha: m.fecha,
      tipo: this.tipoKardex[m.tipo]?.etiqueta ?? m.tipo,
      entrada: m.entrada,
      salida: m.salida,
      costo_unitario: m.costoUnitario,
      saldo: m.saldoResultante,
      nota: m.nota ?? "",
    }),
  });

  async cargar(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.insumos.set(await this.insumosService.list());
    } catch {
      this.error.set("No se pudo cargar los insumos.");
    } finally {
      this.loading.set(false);
    }
  }

  async crear(): Promise<void> {
    if (this.form.invalid) return;
    await this.insumosService.create(this.form.getRawValue());
    this.form.reset({ categoria: "flor", unidadBase: "tallo", stockMinimo: 0, esFlor: false, esCaja: false });
    this.mostrarForm.set(false);
    await this.cargar();
  }

  editar(insumo: Insumo): void {
    this.editingId.set(insumo.id);
    this.editForm.setValue({
      nombre: insumo.nombre,
      stockMinimo: Number(insumo.stockMinimo),
      activo: insumo.activo,
    });
  }

  cancelarEdicion(): void {
    this.editingId.set(null);
  }

  async guardarEdicion(id: string): Promise<void> {
    if (this.editForm.invalid) return;
    await this.insumosService.update(id, this.editForm.getRawValue());
    this.editingId.set(null);
    await this.cargar();
  }

  async verKardex(insumo: Insumo): Promise<void> {
    this.kardexDe.set(insumo);
    this.tablaKardex.limpiar();
    this.tablaKardex.pagina.set(1);
    this.filtroKardex.set("todos");
    this.kardexMovimientos.set([]);
    this.cargandoKardex.set(true);
    const movimientos = await this.insumosService.kardex(insumo.id);
    // Si mientras cargaba se abrió otro insumo (o se cerró), esta respuesta ya no vale.
    if (this.kardexDe() !== insumo) return;
    this.kardexMovimientos.set(movimientos);
    this.cargandoKardex.set(false);
  }

  @HostListener("document:keydown.escape")
  cerrarKardex(): void {
    this.kardexDe.set(null);
  }

  async onArchivoApertura(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.aperturaMensaje.set(null);
    this.aperturaErrores.set([]);

    try {
      const texto = await file.text();
      const lineas = this.parseCsv(texto);
      const resultado = await this.insumosService.cargarApertura({ lineas });
      this.aperturaMensaje.set(`Se cargaron ${resultado.cargados} insumos con su saldo de apertura.`);
      await this.cargar();
    } catch (err) {
      const body = (err as { error?: { errores?: string[]; message?: string } })?.error;
      if (body?.errores?.length) {
        this.aperturaErrores.set(body.errores);
      } else {
        this.aperturaErrores.set([body?.message ?? "No se pudo procesar el archivo CSV."]);
      }
    } finally {
      input.value = "";
    }
  }

  private parseCsv(texto: string): { codigo: string; cantidad: number; costoUnitario: number }[] {
    const filas = texto
      .split(/\r?\n/)
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    // Admite encabezado opcional: codigo,cantidad,costoUnitario
    const inicio = /^codigo/i.test(filas[0]) ? 1 : 0;

    return filas.slice(inicio).map((fila) => {
      const [codigo, cantidad, costoUnitario] = fila.split(",").map((v) => v.trim());
      return { codigo, cantidad: Number(cantidad), costoUnitario: Number(costoUnitario) };
    });
  }
}
