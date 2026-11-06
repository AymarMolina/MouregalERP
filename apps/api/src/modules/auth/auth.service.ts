import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import type { AuthUser } from '@erp/shared';
import { DB } from '../../db/db.module';
import type { Db } from '../../db/client';
import { usuarios } from '../../db/schema';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ user: AuthUser } & TokenPair> {
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
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const user = this.toAuthUser(usuario);
    return { user, ...(await this.issueTokens(user)) };
  }

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

    return this.issueTokens(this.toAuthUser(usuario));
  }

  async me(userId: string): Promise<AuthUser> {
    const [usuario] = await this.db
      .select()
      .from(usuarios)
      .where(eq(usuarios.id, userId))
      .limit(1);
    if (!usuario) throw new UnauthorizedException();
    return this.toAuthUser(usuario);
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<{ sub: string }> {
    try {
      return await this.jwt.verifyAsync<{ sub: string }>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }
  }

  private async issueTokens(user: AuthUser): Promise<TokenPair> {
    const payload = { sub: user.id, rol: user.rol };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: '15m',
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);
    return { accessToken, refreshToken };
  }

  private toAuthUser(usuario: typeof usuarios.$inferSelect): AuthUser {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    };
  }
}
