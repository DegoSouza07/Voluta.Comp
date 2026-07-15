import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';

jest.mock('puppeteer', () => ({ __esModule: true, default: {} }));

import { PdfRenderProcessor } from './pdf-render.processor';
import { PdfRenderService } from '../pdf-render.service';
import { ProjectsService } from '../../projects/projects.service';
import { StorageService } from '../../media/storage.service';
import { Project } from '../../projects/entities/project.entity';
import { createMockRepository, MockRepository } from '../../../common/testing/mock-repository';

describe('PdfRenderProcessor', () => {
  let processor: PdfRenderProcessor;
  let projectsRepo: MockRepository<Project>;
  let pdfRenderService: { renderProjectToPdf: jest.Mock };
  let projectsService: { attachRenderedPdf: jest.Mock };
  let storage: { uploadBuffer: jest.Mock };

  beforeEach(async () => {
    projectsRepo = createMockRepository<Project>();
    pdfRenderService = { renderProjectToPdf: jest.fn() };
    projectsService = { attachRenderedPdf: jest.fn() };
    storage = { uploadBuffer: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        PdfRenderProcessor,
        { provide: PdfRenderService, useValue: pdfRenderService },
        { provide: ProjectsService, useValue: projectsService },
        { provide: StorageService, useValue: storage },
        { provide: getRepositoryToken(Project), useValue: projectsRepo },
      ],
    }).compile();

    processor = module.get(PdfRenderProcessor);
  });

  it('descarta o job silenciosamente se o projeto foi apagado entre o enqueue e o processamento', async () => {
    projectsRepo.findOne.mockResolvedValue(null);
    await processor.process({ data: { projectId: 'sumiu' } } as any);
    expect(pdfRenderService.renderProjectToPdf).not.toHaveBeenCalled();
  });

  it('carrega o projeto com client + posts + media (o mapper precisa da árvore inteira numa passada só)', async () => {
    projectsRepo.findOne.mockResolvedValue({ id: 'proj-1' });
    pdfRenderService.renderProjectToPdf.mockResolvedValue(Buffer.from('pdf-bytes'));
    storage.uploadBuffer.mockResolvedValue('https://cdn.test/plano.pdf');

    await processor.process({ data: { projectId: 'proj-1' } } as any);

    expect(projectsRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        relations: expect.objectContaining({ client: true, posts: expect.objectContaining({ media: true }) }),
      }),
    );
  });

  it('sobe o PDF gerado e chama attachRenderedPdf com a URL final', async () => {
    projectsRepo.findOne.mockResolvedValue({ id: 'proj-1' });
    pdfRenderService.renderProjectToPdf.mockResolvedValue(Buffer.from('pdf-bytes'));
    storage.uploadBuffer.mockResolvedValue('https://cdn.test/projects/proj-1/plano.pdf');

    await processor.process({ data: { projectId: 'proj-1' } } as any);

    expect(storage.uploadBuffer).toHaveBeenCalledWith(
      expect.stringContaining('projects/proj-1/'),
      expect.any(Buffer),
      'application/pdf',
    );
    expect(projectsService.attachRenderedPdf).toHaveBeenCalledWith('proj-1', 'https://cdn.test/projects/proj-1/plano.pdf');
  });

  it('@Processor está configurado com concurrency:1 e lockDuration >= 60s (proteção contra 2 Chromiums processando o mesmo render)', () => {
    // Regressão: sem isso, um render lento pode ser marcado como "travado"
    // pelo BullMQ (lockDuration padrão é só 30s) e reprocessado por OUTRO
    // worker enquanto o primeiro ainda está rodando — dois Chromiums pro
    // mesmo job, RAM em dobro, sem nenhum erro visível nos logs.
    const reflector = new Reflector();
    const workerOptions = reflector.get('bullmq:worker_metadata', PdfRenderProcessor);

    expect(workerOptions).toBeDefined();
    expect(workerOptions.concurrency).toBe(1);
    expect(workerOptions.lockDuration).toBeGreaterThanOrEqual(60_000);
  });
});
