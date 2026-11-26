import type { Tour } from "../tour.types";
import { TOUR_COMPRAS } from "./compras";
import { TOUR_DELIVERY } from "./delivery";
import { TOUR_HOY } from "./hoy";
import { TOUR_INVENTARIO } from "./inventario";
import { TOUR_MAPA } from "./mapa";
import { TOUR_PAGOS } from "./pagos";
import { TOUR_PEDIDO_DETALLE } from "./pedido-detalle";
import { TOUR_PEDIDO_NUEVO } from "./pedido-nuevo";
import { TOUR_PEDIDOS } from "./pedidos";
import { TOUR_PRODUCCION } from "./produccion";
import { TOUR_RECETAS } from "./recetas";
import { TOUR_REGLAS } from "./reglas";
import { TOUR_REPORTES } from "./reportes";
import { TOUR_TARIFARIO } from "./tarifario";

export { TOUR_GENERAL } from "./general";

/** Ruta exacta → tutorial. El detalle de pedido se resuelve aparte por tener id. */
const POR_RUTA: Record<string, Tour> = {
  "/mapa": TOUR_MAPA,
  "/hoy": TOUR_HOY,
  "/pedidos": TOUR_PEDIDOS,
  "/pedidos/nuevo": TOUR_PEDIDO_NUEVO,
  "/produccion": TOUR_PRODUCCION,
  "/delivery": TOUR_DELIVERY,
  "/pagos": TOUR_PAGOS,
  "/inventario": TOUR_INVENTARIO,
  "/compras": TOUR_COMPRAS,
  "/config/recetas": TOUR_RECETAS,
  "/config/reglas": TOUR_REGLAS,
  "/config/tarifario": TOUR_TARIFARIO,
  "/reportes": TOUR_REPORTES,
};

export function tourDeUrl(url: string): Tour | null {
  const ruta = url.split(/[?#]/)[0];
  if (POR_RUTA[ruta]) return POR_RUTA[ruta];
  if (/^\/pedidos\/[^/]+$/.test(ruta)) return TOUR_PEDIDO_DETALLE;
  return null;
}
