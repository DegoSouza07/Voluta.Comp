import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantResource } from '../../common/decorators/tenant-resource.decorator';
import { TenantResourceType } from '../../common/enums/tenant-resource-type.enum';

/**
 * Rota interna (painel Voluta) pra ver o histórico de aprovações/pedidos
 * de ajuste de um post — diferente do PublicController, que é onde o
 * cliente final ENVIA a aprovação. Aqui a equipe só LÊ o que já foi
 * enviado.
 */
@Controller('posts/:postId/approvals')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@TenantResource(TenantResourceType.POST, 'postId')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Get()
  findByPost(@Param('postId', ParseUUIDPipe) postId: string) {
    return this.approvalService.findByPost(postId);
  }
}
