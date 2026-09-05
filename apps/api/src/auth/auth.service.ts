import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import { JwtPayload } from './types/jwt-payload.type.js';

const SALT_ROUNDS = 10;

export interface AuthResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async signUp(email: string, password: string): Promise<AuthResult> {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await this.usersService.create(email, passwordHash);

    return this.buildAuthResult(user.id, user.email);
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResult(user.id, user.email);
  }

  private buildAuthResult(userId: string, email: string): AuthResult {
    const payload: JwtPayload = { sub: userId, email };
    return {
      accessToken: this.jwtService.sign(payload),
      user: { id: userId, email },
    };
  }
}
