import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { loginSchema, refreshSchema } from '@erp/shared';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import type { JwtPayload } from './strategies/jwt-access.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: unknown, @Req() req: Request) {
    const { email, password } = loginSchema.parse(body);
    return this.authService.login(email, password, req.ip ?? 'desconocida');
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: unknown) {
    const { refreshToken } = refreshSchema.parse(body);
    return this.authService.refresh(refreshToken);
  }

  /** Cierra la sesión en todos los dispositivos del usuario. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request & { user: JwtPayload }) {
    await this.authService.logout(req.user.sub);
  }

  @Get('me')
  me(@Req() req: Request & { user: JwtPayload }) {
    return this.authService.me(req.user.sub);
  }
}
