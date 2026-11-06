import { pgEnum } from 'drizzle-orm/pg-core';
import {
  CANAL,
  ESTADO_CONSULTA,
  ESTADO_OC,
  ESTADO_PAGO,
  ESTADO_PEDIDO,
  ESTADO_REGLA,
  INSUMO_CATEGORIA,
  METODO_PAGO,
  ROL_USUARIO,
  TALLA,
  TIPO_CAMBIO,
  TIPO_MOVIMIENTO,
  TIPO_PAGO,
  UNIDAD_BASE,
  VEHICULO,
} from '@erp/shared';

export const rolUsuarioEnum = pgEnum('rol_usuario', ROL_USUARIO);
export const unidadBaseEnum = pgEnum('unidad_base', UNIDAD_BASE);
export const tallaEnum = pgEnum('talla', TALLA);
export const canalEnum = pgEnum('canal', CANAL);
export const estadoPedidoEnum = pgEnum('estado_pedido', ESTADO_PEDIDO);
export const vehiculoEnum = pgEnum('vehiculo', VEHICULO);
export const tipoMovimientoEnum = pgEnum('tipo_movimiento', TIPO_MOVIMIENTO);
export const tipoCambioEnum = pgEnum('tipo_cambio', TIPO_CAMBIO);
export const estadoReglaEnum = pgEnum('estado_regla', ESTADO_REGLA);
export const estadoConsultaEnum = pgEnum('estado_consulta', ESTADO_CONSULTA);
export const tipoPagoEnum = pgEnum('tipo_pago', TIPO_PAGO);
export const metodoPagoEnum = pgEnum('metodo_pago', METODO_PAGO);
export const estadoPagoEnum = pgEnum('estado_pago', ESTADO_PAGO);
export const estadoOcEnum = pgEnum('estado_oc', ESTADO_OC);
export const insumoCategoriaEnum = pgEnum('insumo_categoria', INSUMO_CATEGORIA);
