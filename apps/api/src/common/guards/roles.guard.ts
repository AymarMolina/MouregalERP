import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { RolUsuario } from '@erp/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { JwtPayload } from '../../modules/auth/strategies/jwt-access.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RolUsuario[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    return !!request.user && requiredRoles.includes(request.user.rol);
  }
}
