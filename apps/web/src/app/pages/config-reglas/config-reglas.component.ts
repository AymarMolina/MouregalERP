import { Component, OnInit, inject, signal } from "@angular/core";
import { IconComponent } from "../../shared/icon/icon.component";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import type { AjusteModo, EstadoRegla, TipoCambio } from "@erp/shared";
import { AJUSTE_MODO, ESTADO_REGLA, TIPO_CAMBIO } from "@erp/shared";
import type { Insumo, Producto, ReglaCambio } from "../../core/catalogo/catalogo.types";
import { InsumosService } from "../../core/catalogo/insumos.service";
import { ProductosService } from "../../core/catalogo/productos.service";
import { ReglasCambioService } from "../../core/catalogo/reglas-cambio.service";

@Component({
  selector: "app-config-reglas",
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: "./config-reglas.component.html",
})
export class ConfigReglasComponent implements OnInit {
  private readonly reglasService = inject(ReglasCambioService);
  private readonly productosService = inject(ProductosService);
  private readonly insumosService = inject(InsumosService);
  private readonly fb = inject(FormBuilder);

  readonly tipos: TipoCambio[] = [...TIPO_CAMBIO];
  readonly ajusteModos: AjusteModo[] = [...AJUSTE_MODO];
  readonly estados: EstadoRegla[] = [...ESTADO_REGLA];

  readonly reglas = signal<ReglaCambio[]>([]);
  readonly productos = signal<Producto[]>([]);
  readonly insumos = signal<Insumo[]>([]);
  readonly loading = signal(true);
  readonly mostrarForm = signal(false);

  readonly form = this.fb.nonNullable.group({
    tipo: ["flor" as TipoCambio, Validators.required],
    productoId: [""],
    insumoOrigenId: [""],
    insumoDestinoId: [""],
    descripcion: [""],
    ajusteModo: ["fijo" as AjusteModo, Validators.required],
    ajusteMonto: [0, Validators.required],
    estado: ["aprobado" as EstadoRegla, Validators.required],
  });

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    const [reglas, productos, insumos] = await Promise.all([
      this.reglasService.list(),
      this.productosService.list(),
      this.insumosService.list(),
    ]);
    this.reglas.set(reglas);
    this.productos.set(productos);
    this.insumos.set(insumos);
    this.loading.set(false);
  }

  nombreProducto(id: string | null): string {
    if (!id) return "Todos";
    return this.productos().find((p) => p.id === id)?.nombre ?? "—";
  }

  nombreInsumo(id: string | null): string {
    if (!id) return "—";
    return this.insumos().find((i) => i.id === id)?.nombre ?? "—";
  }

  async crear(): Promise<void> {
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    await this.reglasService.create({
      ...raw,
      productoId: raw.productoId || null,
      insumoOrigenId: raw.insumoOrigenId || null,
      insumoDestinoId: raw.insumoDestinoId || null,
    });
    this.form.reset({ tipo: "flor", ajusteModo: "fijo", ajusteMonto: 0, estado: "aprobado" });
    this.mostrarForm.set(false);
    this.reglas.set(await this.reglasService.list());
  }

  async eliminar(id: string): Promise<void> {
    await this.reglasService.remove(id);
    this.reglas.set(await this.reglasService.list());
  }
}
