import { Component, OnInit, inject, signal } from "@angular/core";
import { IconComponent } from "../../shared/icon/icon.component";
import { RowMenuComponent } from "../../shared/tabla/row-menu.component";
import { Tabla } from "../../shared/tabla/tabla";
import { TABLA_CONTROLES } from "../../shared/tabla/tabla-controles.component";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import type { Distrito } from "../../core/catalogo/catalogo.types";
import { CostosVehiculoService, DistritosService } from "../../core/catalogo/distritos.service";

@Component({
  selector: "app-config-tarifario",
  imports: [ReactiveFormsModule, IconComponent, RowMenuComponent, ...TABLA_CONTROLES],
  templateUrl: "./config-tarifario.component.html",
})
export class ConfigTarifarioComponent implements OnInit {
  private readonly distritosService = inject(DistritosService);
  private readonly costosService = inject(CostosVehiculoService);
  private readonly fb = inject(FormBuilder);

  readonly distritos = signal<Distrito[]>([]);
  readonly tabla = new Tabla(() => this.distritos(), {
    id: (d) => d.id,
    porPagina: 10,
    nombreCsv: "tarifario",
    csv: (d) => ({ distrito: d.nombre, moto: d.tarifaMoto, carro: d.tarifaCarro, activo: d.activo ? "Sí" : "No" }),
  });
  readonly loading = signal(true);
  readonly mostrarForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly costoMensaje = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    nombre: ["", Validators.required],
    tarifaMoto: [0, [Validators.required, Validators.min(0)]],
    tarifaCarro: [0, [Validators.required, Validators.min(0)]],
  });

  readonly editForm = this.fb.nonNullable.group({
    nombre: ["", Validators.required],
    tarifaMoto: [0, [Validators.required, Validators.min(0)]],
    tarifaCarro: [0, [Validators.required, Validators.min(0)]],
  });

  readonly costosForm = this.fb.nonNullable.group({
    moto: [0, [Validators.required, Validators.min(0)]],
    carro: [0, [Validators.required, Validators.min(0)]],
  });

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    const [distritos, costos] = await Promise.all([this.distritosService.list(), this.costosService.list()]);
    this.distritos.set(distritos);
    const moto = costos.find((c) => c.vehiculo === "moto");
    const carro = costos.find((c) => c.vehiculo === "carro");
    this.costosForm.setValue({
      moto: moto ? Number(moto.costoPorViaje) : 0,
      carro: carro ? Number(carro.costoPorViaje) : 0,
    });
    this.loading.set(false);
  }

  async crear(): Promise<void> {
    if (this.form.invalid) return;
    await this.distritosService.create(this.form.getRawValue());
    this.form.reset({ tarifaMoto: 0, tarifaCarro: 0 });
    this.mostrarForm.set(false);
    this.distritos.set(await this.distritosService.list());
  }

  editar(d: Distrito): void {
    this.editingId.set(d.id);
    this.editForm.setValue({
      nombre: d.nombre,
      tarifaMoto: Number(d.tarifaMoto),
      tarifaCarro: Number(d.tarifaCarro),
    });
  }

  cancelarEdicion(): void {
    this.editingId.set(null);
  }

  async guardarEdicion(id: string): Promise<void> {
    if (this.editForm.invalid) return;
    await this.distritosService.update(id, this.editForm.getRawValue());
    this.editingId.set(null);
    this.distritos.set(await this.distritosService.list());
  }

  async eliminar(id: string): Promise<void> {
    await this.distritosService.remove(id);
    this.distritos.set(await this.distritosService.list());
  }

  async guardarCostos(): Promise<void> {
    if (this.costosForm.invalid) return;
    await this.costosService.update(this.costosForm.getRawValue());
    this.costoMensaje.set("Costos por viaje actualizados.");
    setTimeout(() => this.costoMensaje.set(null), 3000);
  }
}
