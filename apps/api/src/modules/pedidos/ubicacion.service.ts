import { BadRequestException, Injectable } from '@nestjs/common';
import {
  coordenadasDeMaps,
  esHostMaps,
  esLinkCortoMaps,
  type Coordenadas,
} from '@erp/shared';

const MAX_SALTOS = 5;
const TIMEOUT_MS = 6000;
const ERROR_LINK =
  'El link no es de Google Maps o no trae una ubicación. Copia el link de "Compartir" en Google Maps o la ubicación que mandó el cliente por WhatsApp.';

/**
 * Convierte un link de Google Maps en coordenadas. Los links cortos
 * (maps.app.goo.gl) se abren siguiendo las redirecciones, solo hacia hosts de
 * Google y por https (no se puede usar para pedirle al servidor otras URLs).
 */
@Injectable()
export class UbicacionService {
  async resolver(texto: string): Promise<Coordenadas> {
    let url = this.urlPermitida(texto);
    const directa = coordenadasDeMaps(url.href);
    if (directa) return directa;
    if (!esLinkCortoMaps(url)) throw new BadRequestException(ERROR_LINK);

    for (let salto = 0; salto < MAX_SALTOS; salto++) {
      const res = await this.pedir(url);
      const destino = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && destino) {
        url = this.urlPermitida(new URL(destino, url).href);
        // Página de consentimiento (UE): el destino real va en ?continue=
        if (url.hostname === 'consent.google.com') {
          url = this.urlPermitida(url.searchParams.get('continue') ?? '');
        }
        const c = coordenadasDeMaps(url.href);
        if (c) return c;
        continue;
      }
      // Página final sin coordenadas en la URL: el mapa estático de la vista
      // previa (og:image) trae el centro como center=lat%2Clng.
      if (res.ok) {
        const html = await res.text();
        const m = html.match(
          /center=(-?\d{1,3}\.\d+)(?:%2C|,)(-?\d{1,3}\.\d+)/,
        );
        if (m) {
          const c = coordenadasDeMaps(
            `https://maps.google.com/?q=${m[1]},${m[2]}`,
          );
          if (c) return c;
        }
      }
      break;
    }
    throw new BadRequestException(ERROR_LINK);
  }

  private urlPermitida(texto: string): URL {
    let url: URL;
    try {
      url = new URL(texto.trim());
    } catch {
      throw new BadRequestException(ERROR_LINK);
    }
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== 'https:' ||
      !(esHostMaps(host) || host === 'consent.google.com')
    ) {
      throw new BadRequestException(ERROR_LINK);
    }
    return url;
  }

  private async pedir(url: URL): Promise<Response> {
    try {
      return await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'user-agent': 'Mozilla/5.0 (ERP)' },
      });
    } catch {
      throw new BadRequestException(
        'No se pudo abrir el link de Google Maps. Intenta de nuevo.',
      );
    }
  }
}
