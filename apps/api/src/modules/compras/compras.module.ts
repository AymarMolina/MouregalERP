import { Module } from '@nestjs/common';
import { InventarioModule } from '../inventario/inventario.module';
import { PedidosModule } from '../pedidos/pedidos.module';
import { ComprasController } from './compras.controller';
import { ComprasService } from './compras.service';

@Module({
  imports: [InventarioModule, PedidosModule],
  controllers: [ComprasController],
  providers: [ComprasService],
})
export class ComprasModule {}
