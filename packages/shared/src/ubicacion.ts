/** Ubicación de entrega a partir de un link de Google Maps (puro: sin red). */
export interface Coordenadas {
  lat: number;
  lng: number;
}

/** Hosts de Google Maps aceptados (incluye los links cortos que comparte WhatsApp). */
export function esHostMaps(host: string): boolean {
  const h = host.toLowerCase();
  return h === "maps.app.goo.gl" || h === "goo.gl" || /^(www\.|maps\.)?google\.(com|com\.pe|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/.test(h);
}

/** true si es un link corto que hay que abrir para conocer las coordenadas. */
export function esLinkCortoMaps(url: URL): boolean {
  const h = url.hostname.toLowerCase();
  return h === "maps.app.goo.gl" || (h === "goo.gl" && url.pathname.startsWith("/maps"));
}

const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`;

function valida(lat: number, lng: number): Coordenadas | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/**
 * Saca las coordenadas de un link largo de Google Maps. Orden de preferencia:
 * el pin del lugar (`!3d…!4d…`), los parámetros `q`/`query`/`ll`/`destination`,
 * la ruta `/place|search/lat,lng` y, al final, el centro de la vista (`@lat,lng`).
 */
export function coordenadasDeMaps(texto: string): Coordenadas | null {
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return null;
  }
  if (!esHostMaps(url.hostname)) return null;
  const todo = decodeURIComponent(url.href);

  const pin = todo.match(new RegExp(String.raw`!3d${NUM}!4d${NUM}`));
  if (pin) return valida(Number(pin[1]), Number(pin[2]));

  const par = new RegExp(String.raw`^\s*${NUM}\s*,\s*\+?${NUM}\s*$`);
  for (const clave of ["q", "query", "ll", "destination", "daddr"]) {
    const m = url.searchParams.get(clave)?.match(par);
    if (m) return valida(Number(m[1]), Number(m[2]));
  }

  const ruta = decodeURIComponent(url.pathname).match(new RegExp(String.raw`/(?:place|search|dir)/${NUM},\s*\+?${NUM}`));
  if (ruta) return valida(Number(ruta[1]), Number(ruta[2]));

  const vista = todo.match(new RegExp(String.raw`@${NUM},${NUM}`));
  if (vista) return valida(Number(vista[1]), Number(vista[2]));

  return null;
}

/** Link para abrir el punto en la app de Google Maps (celular) o en el navegador. */
export function linkAbrirMaps(c: Coordenadas): string {
  return `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;
}

/** URL del mapa incrustable (sin clave de API). */
export function linkEmbedMaps(c: Coordenadas): string {
  return `https://maps.google.com/maps?q=${c.lat},${c.lng}&z=16&output=embed`;
}
