import { AbstractControl, FormArray, FormGroup } from "@angular/forms";
import type { AvisosService } from "../avisos/avisos.service";

/**
 * Revisa un formulario antes de guardar. Si le falta algo:
 * - marca los campos (se pintan en rojo),
 * - avisa con una notificación de error qué campos faltan,
 * - lleva la pantalla y el cursor al primero.
 * Devuelve true si está completo.
 *
 * El nombre de cada campo se toma de `etiquetas`, o si no de su <label>,
 * aria-label o placeholder en la pantalla.
 */
export function revisarFormulario(
  form: AbstractControl,
  avisos: AvisosService,
  opciones: { etiquetas?: Record<string, string>; raiz?: ParentNode; titulo?: string } = {},
): boolean {
  if (form.valid) return true;
  form.markAllAsTouched();
  const raiz = opciones.raiz ?? document;

  const faltan: string[] = [];
  const invalidos: string[] = [];
  // En el orden en que aparecen en pantalla, para leerlos de arriba abajo.
  const campos = camposInvalidos(form)
    .map((c) => ({ ...c, el: c.nombre ? raiz.querySelector(`[formcontrolname="${c.nombre}"]`) : null }))
    .sort((a, b) => (a.el && b.el ? (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1) : 0));
  for (const { nombre, control } of campos) {
    const etiqueta = opciones.etiquetas?.[nombre] ?? etiquetaEnPantalla(raiz, nombre) ?? humanizar(nombre);
    if (control.hasError("required")) faltan.push(etiqueta);
    else invalidos.push(etiqueta);
  }

  const partes: string[] = [];
  if (faltan.length) partes.push(`Completa: ${lista(unicos(faltan))}.`);
  if (invalidos.length) partes.push(`Revisa: ${lista(unicos(invalidos))}.`);
  avisos.error(opciones.titulo ?? (faltan.length ? "Faltan datos" : "Hay datos por corregir"), partes.join(" ") || undefined);

  irAlPrimerInvalido(raiz);
  return false;
}

/** Lleva la vista y el foco al primer campo marcado como inválido. */
export function irAlPrimerInvalido(raiz: ParentNode = document): void {
  // Espera a que Angular pinte las clases ng-touched/ng-invalid.
  setTimeout(() => {
    const el = raiz.querySelector<HTMLElement>(
      "input.ng-invalid, select.ng-invalid, textarea.ng-invalid, [formcontrolname].ng-invalid",
    );
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
  });
}

function camposInvalidos(control: AbstractControl, nombre = ""): { nombre: string; control: AbstractControl }[] {
  if (control instanceof FormGroup || control instanceof FormArray) {
    return Object.entries(control.controls).flatMap(([k, c]) => (c.invalid ? camposInvalidos(c, k) : []));
  }
  return control.invalid ? [{ nombre, control }] : [];
}

function etiquetaEnPantalla(raiz: ParentNode, nombre: string): string | null {
  if (!nombre || /^\d+$/.test(nombre)) return null;
  const el = raiz.querySelector<HTMLElement>(`[formcontrolname="${nombre}"]`);
  if (!el) return null;
  const porFor = el.id ? raiz.querySelector(`label[for="${el.id}"]`) : null;
  const texto =
    limpiar(porFor?.textContent) ??
    limpiar(el.closest("label")?.firstChild?.textContent) ??
    limpiar(el.closest("label")?.textContent) ??
    limpiar(el.getAttribute("aria-label")) ??
    limpiar(previoLabel(el)?.textContent) ??
    limpiar(el.getAttribute("placeholder"));
  return texto;
}

/** <label class="field-label">Nombre</label><input …>: la etiqueta hermana anterior. */
function previoLabel(el: HTMLElement): Element | null {
  let p = el.previousElementSibling;
  while (p && p.tagName !== "LABEL") p = p.previousElementSibling;
  return p;
}

function limpiar(t: string | null | undefined): string | null {
  const s = (t ?? "").replace(/\s+/g, " ").replace(/[*:]/g, "").trim();
  return s && s.length <= 60 ? s : null;
}

function humanizar(nombre: string): string {
  const s = nombre.replace(/([A-Z])/g, " $1").toLowerCase().trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function unicos(xs: string[]): string[] {
  return [...new Set(xs)];
}

function lista(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
}
