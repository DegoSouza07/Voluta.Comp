import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { findByEmailWithPassword: jest.Mock };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    usersService = { findByEmailWithPassword: jest.fn() };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('retorna um accessToken quando email e senha conferem', async () => {
    const passwordHash = await bcrypt.hash('senha-correta', 4);
    usersService.findByEmailWithPassword.mockResolvedValue({ id: 'u1', passwordHash });

    const result = await service.login({ email: 'a@b.com', password: 'senha-correta' });

    expect(result).toEqual({ accessToken: 'signed.jwt.token' });
    expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 'u1' });
  });

  it('rejeita quando o usuário não existe', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(null);
    await expect(service.login({ email: 'naoexiste@b.com', password: 'x' })).rejects.toThrow(UnauthorizedException);
  });

  it('rejeita quando a senha está errada', async () => {
    const passwordHash = await bcrypt.hash('senha-correta', 4);
    usersService.findByEmailWithPassword.mockResolvedValue({ id: 'u1', passwordHash });

    await expect(service.login({ email: 'a@b.com', password: 'senha-errada' })).rejects.toThrow(UnauthorizedException);
  });

  it('usa a MESMA mensagem de erro pra usuário inexistente e senha errada (não vaza qual dos dois falhou)', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(null);
    let msgUserNotFound = '';
    try {
      await service.login({ email: 'x@b.com', password: 'x' });
    } catch (e) {
      msgUserNotFound = (e as UnauthorizedException).message;
    }

    const passwordHash = await bcrypt.hash('correta', 4);
    usersService.findByEmailWithPassword.mockResolvedValue({ id: 'u1', passwordHash });
    let msgWrongPassword = '';
    try {
      await service.login({ email: 'x@b.com', password: 'errada' });
    } catch (e) {
      msgWrongPassword = (e as UnauthorizedException).message;
    }

    expect(msgUserNotFound).toBe(msgWrongPassword);
  });

  it('rejeita usuário client_viewer sem passwordHash (não autentica por senha)', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue({ id: 'u2', passwordHash: null });
    await expect(service.login({ email: 'cliente@b.com', password: 'qualquer' })).rejects.toThrow(UnauthorizedException);
  });
});
