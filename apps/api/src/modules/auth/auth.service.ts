import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { eq, sql } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import type { AuthUser } from '@erp/shared';
import { DB } from '../../db/db.module';
import type { Db } from '../../db/client';
import { usuarios } from '../../db/schema';
import { LoginRateLimiter } from './login-rate-limiter';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface RefreshPayload {
  sub: string;
  /** usuarios.token_version al emitirlo; si cambió (logout), el token ya no vale. */
  tv: number;
}

type Usuario = typeof usuarios.$inferSelect;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly limiter: LoginRateLimiter,
  ) {}

  async login(
    email: string,
    password: string,
    ip: string,
  ): Promise<{ user: AuthUser } & TokenPair> {
    this.limiter.verificar(ip, email);

    const [usuario] = await this.db
      .select()
      .from(usuarios)
      .where(eq(usuarios.email, email.toLowerCase()))
      .limit(1);

    if (
      !usuario ||
      !usuario.activo ||
      !(await bcrypt.compare(password, usuario.passwordHash))
    ) {
      this.limiter.registrarFallo(ip, email);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    this.limiter.registrarExito(ip, email);
    return {
      user: this.toAuthUser(usuario),
      ...(await this.issueTokens(usuario)),
    };
  }

  /** Cada refresh emite un par nuevo (rotación) firmado con la versión vigente. */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = await this.verifyRefreshToken(refreshToken);

    const [usuario] = await this.db
      .select()
      .from(usuarios)
      .where(eq(usuarios.id, payload.sub))
      .limit(1);
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    if ((payload.tv ?? 0) !== usuario.tokenVersion) {
      throw new UnauthorizedException(
        'La sesión fue cerrada; vuelve a ingresar',
      );
    }

    return this.issueTokens(usuario);
  }

  /**
   * Cierra sesión en todos los dispositivos: invalida los refresh tokens
   * emitidos hasta ahora. El access token vigente expira solo (≤ 15 min).
   */
  async logout(userId: string): Promise<void> {
    await this.db
      .update(usuarios)
      .set({
        tokenVersion: sql`${usuarios.tokenVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(usuarios.id, userId));
  }

  async me(userId: string): Promise<AuthUser> {
    const [usuario] = await this.db
      .select()
      .from(usuarios)
      .where(eq(usuarios.id, userId))
      .limit(1);
    if (!usuario || !usuario.activo) throw new UnauthorizedException();
    return this.toAuthUser(usuario);
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<RefreshPayload> {
    try {
      return await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }
  }

  private async issueTokens(usuario: Usuario): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: usuario.id, rol: usuario.rol },
        {
          secret: this.config.getOrThrow<string>('JWT_SECRET'),
          expiresIn: '15m',
        },
      ),
      this.jwt.signAsync(
        { sub: usuario.id, tv: usuario.tokenVersion } satisfies RefreshPayload,
        {
          secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
          expiresIn: '7d',
        },
      ),
    ]);
    return { accessToken, refreshToken };
  }

  private toAuthUser(usuario: Usuario): AuthUser {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    };
  }
}
