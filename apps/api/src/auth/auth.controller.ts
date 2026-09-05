import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthService, AuthResult } from './auth.service.js';
import { SignUpDto } from './dto/sign-up.dto.js';
import { SignInDto } from './dto/sign-in.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { AuthenticatedUser } from './strategies/jwt.strategy.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sign-up')
  signUp(@Body() dto: SignUpDto): Promise<AuthResult> {
    return this.authService.signUp(dto.email, dto.password);
  }

  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  signIn(@Body() dto: SignInDto): Promise<AuthResult> {
    return this.authService.signIn(dto.email, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
