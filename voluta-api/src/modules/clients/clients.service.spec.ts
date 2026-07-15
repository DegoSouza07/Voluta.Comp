import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClientsService } from './clients.service';
import { Client } from './entities/client.entity';
import { createMockRepository, MockRepository } from '../../common/testing/mock-repository';

describe('ClientsService', () => {
  let service: ClientsService;
  let repo: MockRepository<Client>;

  beforeEach(async () => {
    repo = createMockRepository<Client>();
    const module = await Test.createTestingModule({
      providers: [ClientsService, { provide: getRepositoryToken(Client), useValue: repo }],
    }).compile();
    service = module.get(ClientsService);
  });

  describe('create', () => {
    it('rejeita slug duplicado com ConflictException', async () => {
      repo.findOne.mockResolvedValue({ id: 'existing', slug: 'casapla' });
      await expect(service.create({ name: 'Casa Pla 2', slug: 'casapla' })).rejects.toThrow(ConflictException);
    });

    it('cria normalmente quando o slug é novo', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue({ name: 'Casa Pla', slug: 'casapla' });
      repo.save.mockResolvedValue({ id: 'c1', name: 'Casa Pla', slug: 'casapla' });

      const result = await service.create({ name: 'Casa Pla', slug: 'casapla' });
      expect(result.id).toBe('c1');
    });
  });

  describe('findOne', () => {
    it('lança NotFoundException se o cliente não existe', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('nao-existe')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('faz soft-delete (isActive=false), nunca remove a linha', async () => {
      const client = { id: 'c1', isActive: true };
      repo.findOne.mockResolvedValue(client);
      repo.save.mockImplementation((c: any) => Promise.resolve(c));

      await service.deactivate('c1');

      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('só retorna clientes ativos', async () => {
      repo.find.mockResolvedValue([]);
      await service.findAll();
      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }));
    });
  });
});
