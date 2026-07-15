import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let repo: { createQueryBuilder: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let qb: { addSelect: jest.Mock; where: jest.Mock; getOne: jest.Mock };

  beforeEach(async () => {
    qb = { addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getOne: jest.fn() };
    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [UsersService, { provide: getRepositoryToken(User), useValue: repo }],
    }).compile();

    service = module.get(UsersService);
  });

  it('findByEmailWithPassword pede explicitamente o passwordHash via addSelect (select:false por padrão na entidade)', async () => {
    qb.getOne.mockResolvedValue({ id: 'u1', passwordHash: 'hash' });
    const result = await service.findByEmailWithPassword('a@b.com');

    expect(qb.addSelect).toHaveBeenCalledWith('user.passwordHash');
    expect(result?.passwordHash).toBe('hash');
  });

  it('findById lança NotFoundException quando o usuário não existe', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findById('nao-existe')).rejects.toThrow(NotFoundException);
  });

  it('create salva o usuário via create+save do repository', async () => {
    repo.create.mockImplementation((d: any) => d);
    repo.save.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

    const result = await service.create({ email: 'a@b.com' });

    expect(result.id).toBe('u1');
  });
});
