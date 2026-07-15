import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../../common/enums/user-role.enum';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    usersRepo = { findOne: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { getOrThrow: () => 'fake-secret' } },
        { provide: getRepositoryToken(User), useValue: usersRepo },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
  });

  it('busca o usuário FRESCO no banco a cada validação (não confia só no payload do token)', async () => {
    usersRepo.findOne.mockResolvedValue({
      id: 'u1', email: 'a@b.com', role: UserRole.VOLUTA_ADMIN, clientId: null,
    });

    const result = await strategy.validate({ sub: 'u1' });

    expect(usersRepo.findOne).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(result).toEqual({ id: 'u1', email: 'a@b.com', role: UserRole.VOLUTA_ADMIN, clientId: null });
  });

  it('rejeita o token se o usuário foi removido/desativado desde que o token foi emitido', async () => {
    usersRepo.findOne.mockResolvedValue(null);
    await expect(strategy.validate({ sub: 'usuario-removido' })).rejects.toThrow(UnauthorizedException);
  });
});
