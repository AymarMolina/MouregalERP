import { Component, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DESCUENTO_MAX_VENDEDORA_PCT, ROL_USUARIO, type RolUsuario } from "@erp/shared";
import { AuthService } from "../../core/auth/auth.service";
import { AvisosService } from "../../core/avisos/avisos.service";
import { DialogoService } from "../../core/dialogo/dialogo.service";
import { mensajeError } from "../../core/http/errores";
import { UsuariosAdminService, type UsuarioAdmin } from "../../core/pedidos/usuarios-admin.service";
import { IconComponent } from "../../shared/icon/icon.component";

const ETIQUETA_ROL: Record<RolUsuario, string> = {
  admin: "Admin",
  vendedora: "Vendedora",
  produccion: "Producción",
  almacen: "Almacén",
  delivery: "Delivery",
};

/**
 * Qué puede hacer cada rol. Refleja las reglas del sistema (validarTransicion,
 * @Roles de cada endpoint y las rutas de la web); no es configurable desde aquí.
 */
const PERMISOS: { accion: string; detalle: string; roles: Partial<Record<RolUsuario, string>> }[] = [
  { accion: "Tomar pedidos y cobrar", detalle: "Nuevo pedido, Pagos, Caja", roles: { admin: "Sí", vendedora: "Sí" } },
  { accion: "Cancelar pedidos", detalle: "Lo ya armado cuenta como merma", roles: { admin: "Siempre", vendedora: "Antes de armar" } },
  { accion: "Armar y confirmar consumo", detalle: "Responder consultas, subir fotos", roles: { admin: "Sí", produccion: "Sí" } },
  { accion: "Despachar", detalle: "Pasar a en camino", roles: { admin: "Sí", vendedora: "Sí", delivery: "Sí" } },
  { accion: "Marcar entregado", detalle: "Cobro contra entrega", roles: { admin: "Sí", delivery: "Sí", vendedora: "Solo recojos" } },
  { accion: "Inventario y compras", detalle: "Kardex, ajustes, órdenes", roles: { admin: "Sí", almacen: "Sí" } },
  { accion: "Recetas", detalle: "Productos, tallas y recetas", roles: { admin: "Sí", produccion: "Sí", almacen: "Sí" } },
  { accion: "Reglas, tarifario y usuarios", detalle: "Configuración", roles: { admin: "Sí" } },
  { accion: "Ver reportes", detalle: "Ventas, cobros, margen y merma", roles: { admin: "Sí" } },
  { accion: "Descuentos", detalle: "Siempre con motivo", roles: { admin: "Sin tope", vendedora: `Hasta ${DESCUENTO_MAX_VENDEDORA_PCT} %` } },
];

@Component({
  selector: "app-config-usuarios",
  imports: [FormsModule, IconComponent],
  templateUrl: "./config-usuarios.component.html",
})
export class ConfigUsuariosComponent implements OnInit {
  private readonly api = inject(UsuariosAdminService);
  private readonly avisos = inject(AvisosService);
  private readonly dialogo = inject(DialogoService);
  private readonly auth = inject(AuthService);

  readonly roles = ROL_USUARIO;
  readonly etiquetaRol = ETIQUETA_ROL;
  readonly permisos = PERMISOS;

  readonly usuarios = signal<UsuarioAdmin[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly trabajando = signal<string | null>(null);

  readonly formAbierto = signal(false);
  readonly nuevoNombre = signal("");
  readonly nuevoEmail = signal("");
  readonly nuevoRol = signal<RolUsuario>("vendedora");
  readonly errorForm = signal<string | null>(null);
  /** Contraseña recién generada: se muestra una sola vez. */
  readonly claveNueva = signal<{ nombre: string; email: string; password: string } | null>(null);

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    try {
      this.usuarios.set(await this.api.todos());
      this.error.set(null);
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudieron cargar los usuarios."));
    } finally {
      this.cargando.set(false);
    }
  }

  esYo(u: UsuarioAdmin): boolean {
    return u.id === this.auth.user()?.id;
  }

  async crear(): Promise<void> {
    const nombre = this.nuevoNombre().trim();
    const email = this.nuevoEmail().trim();
    if (nombre.length < 2) return this.errorForm.set("Escribe el nombre.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return this.errorForm.set("Escribe un correo válido.");
    this.errorForm.set(null);
    this.trabajando.set("nuevo");
    try {
      const r = await this.api.crear({ nombre, email, rol: this.nuevoRol() });
      this.formAbierto.set(false);
      this.nuevoNombre.set("");
      this.nuevoEmail.set("");
      if (r.password) this.claveNueva.set({ nombre: r.usuario.nombre, email: r.usuario.email, password: r.password });
      this.avisos.exito("Usuario creado", `${r.usuario.nombre} puede entrar como ${ETIQUETA_ROL[r.usuario.rol].toLowerCase()}.`);
      await this.cargar();
    } catch (err) {
      const m = mensajeError(err, "No se pudo crear el usuario.");
      this.errorForm.set(m);
      this.avisos.error("No se creó el usuario", m);
    } finally {
      this.trabajando.set(null);
    }
  }

  async cambiarRol(u: UsuarioAdmin, rol: RolUsuario): Promise<void> {
    if (rol === u.rol) return;
    await this.editar(u, { rol }, "Rol cambiado", `${u.nombre} ahora es ${ETIQUETA_ROL[rol].toLowerCase()}. Debe volver a entrar.`);
  }

  async alternarActivo(u: UsuarioAdmin): Promise<void> {
    if (u.activo) {
      const ok = await this.dialogo.confirmar({
        titulo: `Desactivar a ${u.nombre}`,
        detalle: "No podrá entrar al sistema y se cierran sus sesiones abiertas. Puedes reactivarlo cuando quieras.",
        aceptar: "Desactivar",
        peligro: true,
      });
      if (!ok) return;
    }
    await this.editar(u, { activo: !u.activo }, u.activo ? "Usuario desactivado" : "Usuario activado", u.nombre);
  }

  async resetear(u: UsuarioAdmin): Promise<void> {
    const ok = await this.dialogo.confirmar({
      titulo: `Nueva contraseña para ${u.nombre}`,
      detalle: "La contraseña actual deja de funcionar y se cierran sus sesiones. Verás la nueva una sola vez.",
      aceptar: "Generar contraseña",
    });
    if (!ok) return;
    this.trabajando.set(u.id);
    try {
      const r = await this.api.nuevaClave(u.id);
      this.claveNueva.set({ nombre: u.nombre, email: u.email, password: r.password });
      this.avisos.exito("Contraseña generada", `Entrégasela a ${u.nombre}.`);
    } catch (err) {
      this.avisos.error("No se generó la contraseña", mensajeError(err, "Intenta de nuevo."));
    } finally {
      this.trabajando.set(null);
    }
  }

  async copiar(texto: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(texto);
      this.avisos.exito("Contraseña copiada");
    } catch {
      this.avisos.error("No se pudo copiar", "Cópiala a mano.");
    }
  }

  private async editar(u: UsuarioAdmin, cambios: Partial<UsuarioAdmin>, titulo: string, detalle: string): Promise<void> {
    this.trabajando.set(u.id);
    try {
      await this.api.editar(u.id, cambios);
      this.avisos.exito(titulo, detalle);
      await this.cargar();
    } catch (err) {
      this.avisos.error("No se guardó el cambio", mensajeError(err, "Intenta de nuevo."));
      await this.cargar();
    } finally {
      this.trabajando.set(null);
    }
  }
}
