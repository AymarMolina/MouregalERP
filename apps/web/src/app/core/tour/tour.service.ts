import { Injectable, computed, inject, signal } from "@angular/core";
import { NavigationEnd, NavigationStart, Router } from "@angular/router";
import { driver, type DriveStep, type Driver } from "driver.js";
import { filter } from "rxjs";
import { AuthService } from "../auth/auth.service";
import type { PasoTour, Tour } from "./tour.types";
import { TOUR_GENERAL, tourDeUrl } from "./tours";

/** Cuánto esperar a que la pantalla pinte sus datos antes de abrir el tutorial. */
const ESPERA_MAX_MS = 2500;
const INTERVALO_MS = 150;

/**
 * Tutorial interactivo por pantalla (driver.js): oscurece la página, ilumina
 * una sección y la explica. Se abre solo la primera vez que cada usuario entra
 * a una pantalla; después se vuelve a ver con el botón "?" de la barra superior.
 *
 * Lo ya visto se guarda en el navegador por usuario (`erp_tours_vistos:<id>`).
 */
@Injectable({ providedIn: "root" })
export class TourService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private activo: Driver | null = null;
  /** Invalida esperas en curso al cambiar de pantalla. */
  private turno = 0;

  private readonly url = signal(this.router.url);
  /** Hay tutorial para la pantalla actual (muestra u oculta el botón "?"). */
  readonly disponible = computed(() => !!tourDeUrl(this.url()));

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationStart)).subscribe(() => this.cerrar());
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.url.set(this.router.url);
      void this.abrirSiEsNuevo();
    });
  }

  /** Botón "?": muestra el tutorial de la pantalla actual aunque ya se haya visto. */
  verTutorial(): void {
    const tour = tourDeUrl(this.router.url);
    if (tour) void this.iniciar(tour, false);
  }

  /** Primera visita: abre el tutorial de la pantalla (y antes el general, si falta). */
  async abrirSiEsNuevo(): Promise<void> {
    const tour = tourDeUrl(this.router.url);
    if (!tour || !this.auth.user()) return;
    const vistos = this.leerVistos();
    if (vistos.has(tour.id)) return;
    await this.iniciar(tour, !vistos.has(TOUR_GENERAL.id));
  }

  cerrar(): void {
    this.turno++;
    this.activo?.destroy();
    this.activo = null;
  }

  private async iniciar(tour: Tour, conGeneral: boolean): Promise<void> {
    this.cerrar();
    const turno = this.turno;
    const rol = this.auth.user()?.rol;

    const pasos = [...(conGeneral ? TOUR_GENERAL.pasos : []), ...tour.pasos].filter(
      (p) => !p.roles || (rol && p.roles.includes(rol)),
    );
    // Espera por las secciones de la pantalla, no por las del marco (menú, buscador), que ya están.
    await this.esperarElementos(pasos.filter((p) => tour.pasos.includes(p)));
    if (turno !== this.turno) return;

    // Solo los pasos cuya sección existe ahora (p. ej. una tabla vacía no muestra sus acciones).
    const visibles = pasos.filter((p) => !p.elemento || this.buscar(p.elemento));
    if (visibles.length === 0) return;

    const marcar = [tour.id, ...(conGeneral ? [TOUR_GENERAL.id] : [])];
    const d = driver({
      steps: visibles.map((p) => this.aPaso(p)),
      showProgress: visibles.length > 1,
      progressText: "{{current}} de {{total}}",
      nextBtnText: "Siguiente",
      prevBtnText: "Anterior",
      doneBtnText: "Entendido",
      popoverClass: "tour-pop",
      overlayColor: "#111827",
      overlayOpacity: 0.55,
      stagePadding: 6,
      stageRadius: 10,
      smoothScroll: true,
      allowClose: true,
      // Al cerrarlo o terminarlo (en cualquier paso) no vuelve a abrirse solo.
      onDestroyed: () => {
        this.marcarVistos(marcar);
        if (this.activo === d) this.activo = null;
      },
      onPopoverRender: (pop) => {
        pop.closeButton.setAttribute("aria-label", "Cerrar tutorial");
        pop.closeButton.setAttribute("title", "Cerrar tutorial");
      },
    });
    this.activo = d;
    d.drive();
  }

  private aPaso(p: PasoTour): DriveStep {
    return {
      element: p.elemento ? `[data-tour="${p.elemento}"]` : undefined,
      popover: { title: p.titulo, description: p.texto, side: p.lado, align: "start" },
    };
  }

  private buscar(clave: string): HTMLElement | null {
    const el = document.querySelector<HTMLElement>(`[data-tour="${clave}"]`);
    // Ignora elementos ocultos (display:none, pestañas no activas).
    return el && el.getClientRects().length > 0 ? el : null;
  }

  /**
   * Espera a que la pantalla pinte alguna sección del tutorial (los datos llegan
   * del API). No espera a todas: algunas solo existen en otro paso del asistente,
   * para otro rol o con una fila seleccionada, y se omiten.
   */
  private async esperarElementos(pasos: PasoTour[]): Promise<void> {
    const claves = pasos.map((p) => p.elemento).filter((c): c is string => !!c);
    if (claves.length === 0) return;
    const inicio = Date.now();
    while (Date.now() - inicio < ESPERA_MAX_MS) {
      if (claves.some((c) => this.buscar(c))) break;
      await new Promise((r) => setTimeout(r, INTERVALO_MS));
    }
    // Un respiro para que lleguen el resto de los datos y terminen de pintar tablas y gráficos.
    await new Promise((r) => setTimeout(r, 600));
  }

  private clave(): string | null {
    const id = this.auth.user()?.id;
    return id ? `erp_tours_vistos:${id}` : null;
  }

  private leerVistos(): Set<string> {
    const clave = this.clave();
    if (!clave) return new Set();
    try {
      const crudo = localStorage.getItem(clave);
      const lista: unknown = crudo ? JSON.parse(crudo) : [];
      return new Set(Array.isArray(lista) ? lista.filter((x): x is string => typeof x === "string") : []);
    } catch {
      return new Set();
    }
  }

  private marcarVistos(ids: string[]): void {
    const clave = this.clave();
    if (!clave) return;
    const vistos = this.leerVistos();
    ids.forEach((id) => vistos.add(id));
    try {
      localStorage.setItem(clave, JSON.stringify([...vistos]));
    } catch {
      // Sin almacenamiento (modo privado): el tutorial volverá a ofrecerse, nada más.
    }
  }
}
