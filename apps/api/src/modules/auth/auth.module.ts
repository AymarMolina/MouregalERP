import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginRateLimiter } from './login-rate-limiter';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { UsuariosController } from './usuarios.controller';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController, UsuariosController],
  providers: [AuthService, JwtAccessStrategy, LoginRateLimiter],
})
export class AuthModule {}
