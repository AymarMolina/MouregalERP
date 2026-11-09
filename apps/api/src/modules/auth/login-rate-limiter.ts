import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface Ventana {
  fallos: number;
  desde: number;
}

const VENTANA_MS = 15 * 60 * 1000;
/** Intentos fallidos permitidos por IP + email dentro de la ventana. */
const MAX_POR_CUENTA = 5;
/** Intentos fallidos permitidos por IP (cualquier email) dentro de la ventana. */
const MAX_POR_IP = 30;

/**
 * Limita los intentos fallidos de login (fuerza bruta). En memoria: basta
 * para una sola instancia del API; con varias instancias habría que moverlo
 * a Redis o a la base de datos.
 */
@Injectable()
export class LoginRateLimiter {
  private readonly ventanas = new Map<string, Ventana>();

  verificar(ip: string, email: string): void {
    const ahora = Date.now();
    for (const [clave, max] of [
      [this.claveCuenta(ip, email), MAX_POR_CUENTA],
      [this.claveIp(ip), MAX_POR_IP],
    ] as const) {
      const v = this.vigente(clave, ahora);
      if (v && v.fallos >= max) {
        const minutos = Math.ceil((v.desde + VENTANA_MS - ahora) / 60000);
        throw new HttpException(
          `Demasiados intentos fallidos. Intenta de nuevo en ${minutos} min.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  registrarFallo(ip: string, email: string): void {
    const ahora = Date.now();
    for (const clave of [this.claveCuenta(ip, email), this.claveIp(ip)]) {
      const v = this.vigente(clave, ahora) ?? { fallos: 0, desde: ahora };
      v.fallos += 1;
      this.ventanas.set(clave, v);
    }
    if (this.ventanas.size > 10_000) this.limpiar(ahora);
  }

  registrarExito(ip: string, email: string): void {
    this.ventanas.delete(this.claveCuenta(ip, email));
  }

  private vigente(clave: string, ahora: number): Ventana | undefined {
    const v = this.ventanas.get(clave);
    if (v && ahora - v.desde > VENTANA_MS) {
      this.ventanas.delete(clave);
      return undefined;
    }
    return v;
  }

  private limpiar(ahora: number) {
    for (const [k, v] of this.ventanas)
      if (ahora - v.desde > VENTANA_MS) this.ventanas.delete(k);
  }

  private claveCuenta(ip: string, email: string) {
    return `c:${ip}|${email.toLowerCase()}`;
  }
  private claveIp(ip: string) {
    return `i:${ip}`;
  }
}
