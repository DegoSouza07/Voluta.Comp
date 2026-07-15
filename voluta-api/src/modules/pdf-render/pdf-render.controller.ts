import { Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class PdfRenderController {
  constructor(@InjectQueue('pdf-render') private readonly pdfRenderQueue: Queue) {}

  // Dispara a geração assíncrona do PDF — nunca síncrono no request
  // (Etapa 1/5: um render pode levar vários segundos, incompatível com
  // o tempo de resposta de uma request HTTP comum).
  @Post(':id/render-pdf')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerRender(@Param('id', ParseUUIDPipe) id: string) {
    await this.pdfRenderQueue.add('render-project', { projectId: id });
    return { queued: true, projectId: id };
  }
}
