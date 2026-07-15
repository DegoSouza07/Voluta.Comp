import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { SubmitApprovalDto } from './dto/submit-approval.dto';
import { ProjectsService } from '../projects/projects.service';

/**
 * Rotas do portal de aprovação do cliente final (Etapa 6).
 * DELIBERADAMENTE sem JwtAuthGuard — a segurança aqui é o slug
 * não-sequencial (nanoid) do projeto, não sessão de usuário.
 * Nunca adicionar rota aqui que exponha dado de outro projeto/cliente
 * a partir de um ID sequencial ou previsível.
 */
@Controller('public')
export class PublicController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly approvalService: ApprovalService,
  ) {}

  @Get('plano/:slug')
  getPublicPlan(@Param('slug') slug: string) {
    return this.projectsService.findByPublicSlug(slug);
  }

  @Post('posts/:postId/approval')
  submitApproval(@Param('postId') postId: string, @Body() dto: SubmitApprovalDto) {
    return this.approvalService.submit(postId, dto);
  }
}
