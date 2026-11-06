import { Component, OnInit, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import type { InsumoCategoria, UnidadBase } from "@erp/shared";
import { INSUMO_CATEGORIA, UNIDAD_BASE } from "@erp/shared";
import type { Insumo } from "../../core/catalogo/catalogo.types";
import { InsumosService } from "../../core/catalogo/insumos.service";

@Component({
  selector: "app-inventario",
  imports: [ReactiveFormsModule],
  templateUrl: "./inventario.component.html",
})
export class InventarioComponent implements OnInit {
  private readonly insumosService = inject(InsumosService);
  private readonly fb = inject(FormBuilder);

  readonly categorias: InsumoCategoria[] = [...INSUMO_CATEGORIA];
  readonly unidades: UnidadBase[] = [...UNIDAD_BASE];

  readonly insumos = signal<Insumo[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly mostrarForm = signal(false);
  readonly aperturaMensaje = signal<string | null>(null);
  readonly aperturaErrores = signal<string[]>([]);

  readonly form = this.fb.nonNullable.group({
    codigo: ["", Validators.required],
    nombre: ["", Validators.required],
    categoria: ["flor" as InsumoCategoria, Validators.required],
    unidadBase: ["tallo" as UnidadBase, Validators.required],
    stockMinimo: [0, [Validators.required, Validators.min(0)]],
    esFlor: [false],
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
    return Number(insumo.stockActual) < Number(insumo.stockMinimo);
  }

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
    this.form.reset({ categoria: "flor", unidadBase: "tallo", stockMinimo: 0, esFlor: false });
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
