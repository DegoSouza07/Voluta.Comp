import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectsService } from './projects.service';
import { Project } from './entities/project.entity';
import { ProjectStatus } from '../../common/enums/project-status.enum';
import { createMockRepository, MockRepository } from '../../common/testing/mock-repository';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let repo: MockRepository<Project>;

  beforeEach(async () => {
    repo = createMockRepository<Project>();
    const module = await Test.createTestingModule({
      providers: [ProjectsService, { provide: getRepositoryToken(Project), useValue: repo }],
    }).compile();
    service = module.get(ProjectsService);
  });

  describe('publish', () => {
    it('gera um public_slug quando o projeto ainda não tem um', async () => {
      repo.findOne.mockResolvedValue({ id: 'p1', publicSlug: null, status: ProjectStatus.IN_REVIEW });
      repo.save.mockImplementation((p: any) => Promise.resolve(p));

      const result = await service.publish('p1');

      expect(result.publicSlug).toBeTruthy();
      expect(typeof result.publicSlug).toBe('string');
      expect(result.status).toBe(ProjectStatus.PUBLISHED);
    });

    it('NÃO gera um novo slug se o projeto já tinha um (republicar não invalida o link existente)', async () => {
      repo.findOne.mockResolvedValue({ id: 'p1', publicSlug: 'slug-existente', status: ProjectStatus.IN_REVIEW });
      repo.save.mockImplementation((p: any) => Promise.resolve(p));

      const result = await service.publish('p1');

      expect(result.publicSlug).toBe('slug-existente');
    });
  });

  describe('findByPublicSlug', () => {
    it('lança NotFoundException com mensagem genérica quando o slug não existe (não revela se é ID inválido ou projeto despublicado)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findByPublicSlug('slug-invalido')).rejects.toThrow(NotFoundException);
    });
  });

  describe('attachRenderedPdf', () => {
    it('grava a URL do PDF e a data de geração', async () => {
      repo.findOne.mockResolvedValue({ id: 'p1', pdfUrl: null, pdfGeneratedAt: null });
      repo.save.mockImplementation((p: any) => Promise.resolve(p));

      const result = await service.attachRenderedPdf('p1', 'https://bucket/plano.pdf');

      expect(result.pdfUrl).toBe('https://bucket/plano.pdf');
      expect(result.pdfGeneratedAt).toBeInstanceOf(Date);
    });
  });

  describe('create', () => {
    it('associa o projeto ao usuário criador (createdBy)', async () => {
      repo.create.mockImplementation((d: any) => d);
      repo.save.mockImplementation((p: any) => Promise.resolve({ id: 'p1', ...p }));

      const result = await service.create(
        { clientId: 'c1', title: 'Julho 2026', referenceMonth: '2026-07-01' },
        { id: 'user-1', email: 'x@y.com', role: 'voluta_admin' as any, clientId: null },
      );

      expect(result.createdBy).toBe('user-1');
    });
  });
});
