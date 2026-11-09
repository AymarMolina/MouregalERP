import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { DbModule } from './db/db.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogoModule } from './modules/catalogo/catalogo.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { InventarioModule } from './modules/inventario/inventario.module';
import { PedidosModule } from './modules/pedidos/pedidos.module';
import { ComprasModule } from './modules/compras/compras.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.service';
import { PagosModule } from './modules/pagos/pagos.module';
import { ReportesModule } from './modules/reportes/reportes.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    NotificacionesModule,
    AuthModule,
    CatalogoModule,
    InventarioModule,
    PedidosModule,
    PagosModule,
    ComprasModule,
    ReportesModule,
    DashboardModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
