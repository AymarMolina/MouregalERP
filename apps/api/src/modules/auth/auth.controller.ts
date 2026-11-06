import { Body, Controller, Get, Post, Req } from '@nestjs/common';
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
  login(@Body() body: unknown) {
    const { email, password } = loginSchema.parse(body);
    return this.authService.login(email, password);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() body: unknown) {
    const { refreshToken } = refreshSchema.parse(body);
    return this.authService.refresh(refreshToken);
  }

  @Get('me')
  me(@Req() req: Request & { user: JwtPayload }) {
    return this.authService.me(req.user.sub);
  }
}
