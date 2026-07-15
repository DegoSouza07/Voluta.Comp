import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TENANT_RESOURCE_KEY, TenantResourceMeta } from '../decorators/tenant-resource.decorator';
import { TenantResourceType } from '../enums/tenant-resource-type.enum';
import { UserRole } from '../enums/user-role.enum';
import { Project } from '../../modules/projects/entities/project.entity';
import { Post } from '../../modules/posts/entities/post.entity';

/**
 * Isola dados por cliente pra usuários `client_viewer`. Sem isso, qualquer
 * pessoa autenticada consegue ver o projeto/post de OUTRO cliente só
 * trocando o UUID na URL — o JwtAuthGuard só prova QUEM é a pessoa, não
 * garante O QUE ela pode ver.
 *
 * `voluta_admin`/`voluta_editor` sempre passam direto: numa instância de
 * agência única, a equipe da Voluta enxerga todos os clientes por design.
 * A restrição é só pro papel `client_viewer`, que representa o cliente
 * final acessando os próprios dados.
 *
 * Precisa vir DEPOIS do JwtAuthGuard na lista de @UseGuards — depende de
 * `request.user` já estar preenchido.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Project) private readonly projectsRepository: Repository<Project>,
    @InjectRepository(Post) private readonly postsRepository: Repository<Post>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<TenantResourceMeta>(TENANT_RESOURCE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return true; // rota não marcada como recurso de cliente — nada a checar

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Sem usuário autenticado, quem decide é o JwtAuthGuard (que já roda antes).
    if (!user) return true;

    // Equipe Voluta enxerga todos os clientes por design (instância de agência única).
    if (user.role !== UserRole.CLIENT_VIEWER) return true;

    const resourceId = request.params[meta.param];
    if (!resourceId) return true; // rota mal configurada — não é este guard que deve falhar por isso

    const ownerClientId = await this.resolveOwnerClientId(meta.type, resourceId);

    if (ownerClientId !== user.clientId) {
      // Mesma exceção genérica em todos os casos — não confirma se o
      // recurso existe e pertence a outro cliente, ou se não existe.
      throw new ForbiddenException('Você não tem permissão para acessar este recurso.');
    }

    return true;
  }

  private async resolveOwnerClientId(type: TenantResourceType, resourceId: string): Promise<string | null> {
    switch (type) {
      case TenantResourceType.CLIENT:
        return resourceId;

      case TenantResourceType.PROJECT: {
        const project = await this.projectsRepository.findOne({ where: { id: resourceId } });
        if (!project) throw new NotFoundException('Projeto não encontrado.');
        return project.clientId;
      }

      case TenantResourceType.POST: {
        const post = await this.postsRepository.findOne({
          where: { id: resourceId },
          relations: { project: true },
        });
        if (!post) throw new NotFoundException('Post não encontrado.');
        return post.project.clientId;
      }
    }
  }
}
