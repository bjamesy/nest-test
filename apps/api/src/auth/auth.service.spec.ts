import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: { findByEmail: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  let jwtService: { sign: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    usersService = {
      findByEmail: vi.fn(),
      create: vi.fn(),
    };
    jwtService = {
      sign: vi.fn().mockReturnValue('signed.jwt.token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    authService = module.get(AuthService);
  });

  describe('signUp', () => {
    it('creates a user with a hashed password and returns a signed token', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue({ id: 'user-1', email: 'new@example.com' });

      const result = await authService.signUp('new@example.com', 'password123');

      expect(usersService.create).toHaveBeenCalledTimes(1);
      const [, passwordHash] = usersService.create.mock.calls[0];
      expect(await bcrypt.compare('password123', passwordHash)).toBe(true);
      expect(jwtService.sign).toHaveBeenCalledWith({ sub: 'user-1', email: 'new@example.com' });
      expect(result).toEqual({
        accessToken: 'signed.jwt.token',
        user: { id: 'user-1', email: 'new@example.com' },
      });
    });

    it('throws ConflictException when the email is already registered', async () => {
      usersService.findByEmail.mockResolvedValue({ id: 'existing', email: 'new@example.com' });

      await expect(authService.signUp('new@example.com', 'password123')).rejects.toThrow(
        ConflictException,
      );
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('signIn', () => {
    it('returns a signed token when credentials are valid', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash,
      });

      const result = await authService.signIn('test@example.com', 'password123');

      expect(result).toEqual({
        accessToken: 'signed.jwt.token',
        user: { id: 'user-1', email: 'test@example.com' },
      });
    });

    it('throws UnauthorizedException when the user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(authService.signIn('missing@example.com', 'password123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the password does not match', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash,
      });

      await expect(authService.signIn('test@example.com', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
