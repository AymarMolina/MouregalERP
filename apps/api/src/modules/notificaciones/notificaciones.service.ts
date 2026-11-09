import { Global, Injectable, Logger, Module } from '@nestjs/common';

export type EventoCliente =
  'pedido_creado' | 'estado_cambiado' | 'link_pago' | 'pago_recibido';

export interface NotificacionCliente {
  pedidoId: string;
  numero: number;
  telefono: string | null;
  evento: EventoCliente;
  mensaje: string;
}

/**
 * Stub de notificaciones al cliente (spec 5.6: "cola o stub en fase 1").
 * Hoy solo registra en el log; en la fase de integraciones se reemplaza por
 * el envío real (WhatsApp Business) sin tocar a quien lo llama.
 */
@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger('Notificaciones');
  /** Últimas notificaciones, útil para depurar y para tests. */
  readonly enviadas: NotificacionCliente[] = [];

  notificarCliente(n: NotificacionCliente): void {
    this.enviadas.push(n);
    if (this.enviadas.length > 200) this.enviadas.shift();
    this.logger.log(
      `[stub] Pedido #${n.numero} → ${n.telefono ?? 'sin teléfono'} (${n.evento}): ${n.mensaje}`,
    );
  }
}

@Global()
@Module({
  providers: [NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
