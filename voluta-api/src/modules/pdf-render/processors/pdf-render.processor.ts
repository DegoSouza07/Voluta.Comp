import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { PdfRenderService } from '../pdf-render.service';
import { Project } from '../../projects/entities/project.entity';
import { ProjectsService } from '../../projects/projects.service';
import { StorageService } from '../../media/storage.service';

interface PdfRenderJobData {
  projectId: string;
}

// concurrency: 1 — Chromium é a peça mais pesada de todo o sistema (só o
// processo do browser já consome ~150-300MB, sem contar a página
// renderizando A3 em alta resolução). 2 renders simultâneos estouram
// qualquer limite de RAM razoável pro worker. Se a fila acumular, é sinal
// de subir mais RÉPLICAS do worker (cada réplica com concurrency:1), não
// de aumentar esse número.
//
// lockDuration: 90_000 — ESSA é a configuração que evita o "loop" mais
// perigoso do sistema: o padrão do BullMQ é 30s. Se um render legítimo
// demorar mais que isso (imagem grande, cold start do Chromium, GC
// pause), o BullMQ marca o job como "travado" e entrega ele pra outro
// worker pegar — resultado: DOIS Chromiums rodando o MESMO PDF ao mesmo
// tempo, dobrando o consumo de RAM sem nenhum erro aparente. O BullMQ
// renova esse lock automaticamente a cada metade do valor (padrão),
// então 90s de lockDuration cobre com folga o timeout duro de 45s do
// PdfRenderService (ver RENDER_TIMEOUT_MS) mesmo com alguma variação de
// carga.
@Processor('pdf-render', { concurrency: 1, lockDuration: 90_000 })
export class PdfRenderProcessor extends WorkerHost {
  private readonly logger = new Logger(PdfRenderProcessor.name);

  constructor(
    private readonly pdfRenderService: PdfRenderService,
    private readonly projectsService: ProjectsService,
    private readonly storageService: StorageService,
    @InjectRepository(Project) private readonly projectsRepository: Repository<Project>,
  ) {
    super();
  }

  async process(job: Job<PdfRenderJobData>): Promise<void> {
    const { projectId } = job.data;

    // Carrega com client + posts — o mapper precisa da árvore inteira
    // pra montar cover/grid/detalhamento numa passada só.
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
      relations: { client: true, posts: { media: true } },
    });
    if (!project) {
      this.logger.warn(`Projeto ${projectId} não encontrado — job descartado.`);
      return;
    }

    const pdfBuffer = await this.pdfRenderService.renderProjectToPdf(project);

    const key = `projects/${project.id}/plano-visual-${Date.now()}.pdf`;
    const pdfUrl = await this.storageService.uploadBuffer(key, pdfBuffer, 'application/pdf');

    await this.projectsService.attachRenderedPdf(project.id, pdfUrl);
    this.logger.log(`PDF do projeto ${projectId} gerado: ${pdfUrl}`);
  }

  onFailed(job: Job<PdfRenderJobData>, error: Error) {
    this.logger.error(`pdf-render falhou pro projeto ${job.data.projectId}: ${error.message}`);
  }
}
