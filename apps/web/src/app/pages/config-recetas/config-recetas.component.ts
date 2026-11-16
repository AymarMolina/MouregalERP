import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { IconComponent } from "../../shared/icon/icon.component";
import { RowMenuComponent } from "../../shared/tabla/row-menu.component";
import { Tabla } from "../../shared/tabla/tabla";
import { TABLA_CONTROLES } from "../../shared/tabla/tabla-controles.component";
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import type { RecetaLineaInput, RolRecetaLinea, Talla } from "@erp/shared";
import { ROL_RECETA_LINEA, TALLA, esUnidadEntera } from "@erp/shared";
import { AuthService } from "../../core/auth/auth.service";
import type { Insumo, Producto, RecetaLinea } from "../../core/catalogo/catalogo.types";
import { InsumosService } from "../../core/catalogo/insumos.service";
import { ProductosService } from "../../core/catalogo/productos.service";

@Component({
  selector: "app-config-recetas",
  imports: [ReactiveFormsModule, IconComponent, RowMenuComponent, ...TABLA_CONTROLES],
  templateUrl: "./config-recetas.component.html",
})
export class ConfigRecetasComponent implements OnInit {
  private readonly productosService = inject(ProductosService);
  private readonly insumosService = inject(InsumosService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly tallas: Talla[] = [...TALLA];
  readonly roles: RolRecetaLinea[] = [...ROL_RECETA_LINEA];
  readonly esAdmin = computed(() => this.auth.user()?.rol === "admin");

  readonly productos = signal<Producto[]>([]);
  readonly tabla = new Tabla(() => this.productos(), {
    id: (p) => p.id,
    porPagina: 10,
    nombreCsv: "productos",
    csv: (p) => ({
      producto: p.nombre,
      precioS: this.tallaDe(p, "S")?.precioBase,
      margenS: this.tallaDe(p, "S")?.margen,
      precioM: this.tallaDe(p, "M")?.precioBase,
      margenM: this.tallaDe(p, "M")?.margen,
      precioL: this.tallaDe(p, "L")?.precioBase,
      margenL: this.tallaDe(p, "L")?.margen,
    }),
  });
  readonly insumos = signal<Insumo[]>([]);

  /** Unidad del insumo de una línea de receta (tallo, g, hoja, m, und). */
  unidadDe(insumoId: string): string {
    return this.insumos().find((i) => i.id === insumoId)?.unidadBase ?? "";
  }

  /** Tallos, hojas y unidades se cargan enteros; gramos y metros admiten decimales. */
  pasoDe(insumoId: string): number {
    return esUnidadEntera(this.unidadDe(insumoId)) ? 1 : 0.001;
  }
  readonly loading = signal(true);
  readonly mostrarFormNuevo = signal(false);

  readonly seleccionado = signal<Producto | null>(null);
  readonly tallaActiva = signal<Talla>("S");
  readonly guardandoReceta = signal(false);
  readonly recetaMensaje = signal<string | null>(null);
  readonly floresPermitidas = signal<Set<string>>(new Set());

  readonly nuevoForm = this.fb.nonNullable.group({
    nombre: ["", Validators.required],
    slug: ["", Validators.required],
    descripcion: [""],
    florPrincipalId: ["", Validators.required],
    usaPapel: [true],
    papelDefaultId: [""],
    precioS: [0, [Validators.required, Validators.min(0)]],
    precioM: [0, [Validators.required, Validators.min(0)]],
    precioL: [0, [Validators.required, Validators.min(0)]],
  });

  readonly detalleForm = this.fb.nonNullable.group({
    nombre: ["", Validators.required],
    descripcion: [""],
    florPrincipalId: ["", Validators.required],
    usaPapel: [true],
    papelDefaultId: [""],
    precioS: [0, [Validators.required, Validators.min(0)]],
    precioM: [0, [Validators.required, Validators.min(0)]],
    precioL: [0, [Validators.required, Validators.min(0)]],
  });

  readonly recetaForm: FormGroup<{ lineas: FormArray<FormGroup> }> = this.fb.group({
    lineas: this.fb.array<FormGroup>([]),
  });

  get lineas(): FormArray<FormGroup> {
    return this.recetaForm.get("lineas") as FormArray<FormGroup>;
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    await this.cargarProductos();
    this.insumos.set(await this.insumosService.list());
    this.loading.set(false);
  }

  private async cargarProductos(): Promise<void> {
    const productos = await this.productosService.list();
    this.productos.set(productos.filter((p) => p.activo));
  }

  async desactivar(id: string): Promise<void> {
    await this.productosService.remove(id);
    if (this.seleccionado()?.id === id) this.cerrarDetalle();
    await this.cargarProductos();
  }

  insumosFlor(): Insumo[] {
    return this.insumos().filter((i) => i.esFlor);
  }

  insumosPapel(): Insumo[] {
    return this.insumos().filter((i) => i.categoria === "papel");
  }

  nombreInsumo(id: string): string {
    return this.insumos().find((i) => i.id === id)?.nombre ?? "—";
  }

  tallaDe(producto: Producto, talla: Talla) {
    return producto.tallas.find((t) => t.talla === talla);
  }

  async crearProducto(): Promise<void> {
    if (this.nuevoForm.invalid) return;
    const v = this.nuevoForm.getRawValue();
    await this.productosService.create({
      nombre: v.nombre,
      slug: v.slug,
      descripcion: v.descripcion || undefined,
      florPrincipalId: v.florPrincipalId,
      usaPapel: v.usaPapel,
      papelDefaultId: v.papelDefaultId || null,
      tallas: [
        { talla: "S", precioBase: v.precioS },
        { talla: "M", precioBase: v.precioM },
        { talla: "L", precioBase: v.precioL },
      ],
    });
    this.nuevoForm.reset({ usaPapel: true, precioS: 0, precioM: 0, precioL: 0 });
    this.mostrarFormNuevo.set(false);
    await this.cargarProductos();
  }

  async seleccionar(producto: Producto): Promise<void> {
    const actualizado = await this.productosService.get(producto.id);
    this.seleccionado.set(actualizado);
    this.setDetalleForm(actualizado);
    const permitidas = await this.productosService.getFloresPermitidas(actualizado.id);
    this.floresPermitidas.set(new Set(permitidas.map((p) => p.insumoId)));
    await this.cambiarTalla("S");
  }

  cerrarDetalle(): void {
    this.seleccionado.set(null);
  }

  private setDetalleForm(p: Producto): void {
    const porTalla = (talla: Talla): number => Number(p.tallas.find((t) => t.talla === talla)?.precioBase ?? 0);
    this.detalleForm.setValue({
      nombre: p.nombre,
      descripcion: p.descripcion ?? "",
      florPrincipalId: p.florPrincipalId,
      usaPapel: p.usaPapel,
      papelDefaultId: p.papelDefaultId ?? "",
      precioS: porTalla("S"),
      precioM: porTalla("M"),
      precioL: porTalla("L"),
    });
  }

  async guardarDetalle(): Promise<void> {
    const producto = this.seleccionado();
    if (!producto || this.detalleForm.invalid) return;
    const v = this.detalleForm.getRawValue();
    const actualizado = await this.productosService.update(producto.id, {
      nombre: v.nombre,
      descripcion: v.descripcion || undefined,
      florPrincipalId: v.florPrincipalId,
      usaPapel: v.usaPapel,
      papelDefaultId: v.papelDefaultId || null,
      tallas: [
        { talla: "S", precioBase: v.precioS },
        { talla: "M", precioBase: v.precioM },
        { talla: "L", precioBase: v.precioL },
      ],
    });
    this.seleccionado.set(actualizado);
    await this.cargarProductos();
  }

  async cambiarTalla(talla: Talla): Promise<void> {
    this.tallaActiva.set(talla);
    const producto = this.seleccionado();
    if (!producto) return;
    const lineas = await this.productosService.getReceta(producto.id, talla);
    this.cargarLineasEnForm(lineas);
  }

  private cargarLineasEnForm(lineas: RecetaLinea[]): void {
    this.lineas.clear();
    for (const l of lineas) {
      this.lineas.push(
        this.fb.group({
          insumoId: [l.insumoId, Validators.required],
          cantidad: [Number(l.cantidad), [Validators.required, Validators.min(0)]],
          rol: [l.rol as RolRecetaLinea, Validators.required],
        }),
      );
    }
  }

  agregarLinea(): void {
    this.lineas.push(
      this.fb.group({
        insumoId: ["", Validators.required],
        cantidad: [0, [Validators.required, Validators.min(0)]],
        rol: ["otro" as RolRecetaLinea, Validators.required],
      }),
    );
  }

  quitarLinea(index: number): void {
    this.lineas.removeAt(index);
  }

  async guardarReceta(): Promise<void> {
    const producto = this.seleccionado();
    if (!producto || this.recetaForm.invalid) return;
    this.guardandoReceta.set(true);
    try {
      await this.productosService.replaceReceta(
        producto.id,
        this.tallaActiva(),
        this.lineas.getRawValue() as RecetaLineaInput[],
      );
      const actualizado = await this.productosService.get(producto.id);
      this.seleccionado.set(actualizado);
      await this.cargarProductos();
      this.recetaMensaje.set("Receta guardada.");
      setTimeout(() => this.recetaMensaje.set(null), 3000);
    } finally {
      this.guardandoReceta.set(false);
    }
  }

  async copiarA(destino: Talla): Promise<void> {
    const producto = this.seleccionado();
    if (!producto) return;
    const actualizado = await this.productosService.copiarReceta(producto.id, this.tallaActiva(), [destino]);
    this.seleccionado.set(actualizado);
    await this.cargarProductos();
    if (this.tallaActiva() === destino) await this.cambiarTalla(destino);
  }

  toggleFlorPermitida(insumoId: string): void {
    const actual = new Set(this.floresPermitidas());
    if (actual.has(insumoId)) actual.delete(insumoId);
    else actual.add(insumoId);
    this.floresPermitidas.set(actual);
  }

  async guardarFloresPermitidas(): Promise<void> {
    const producto = this.seleccionado();
    if (!producto) return;
    await this.productosService.replaceFloresPermitidas(producto.id, [...this.floresPermitidas()]);
  }
}
