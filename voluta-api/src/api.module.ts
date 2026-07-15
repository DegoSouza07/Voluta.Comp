import { Module } from '@nestjs/common';
import { CoreModule } from './core.module';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { PostsModule } from './modules/posts/posts.module';
import { MediaModule } from './modules/media/media.module';
import { ApprovalModule } from './modules/approval/approval.module';
import { PdfRenderModule } from './modules/pdf-render/pdf-render.module';

/**
 * Processo de API — só HTTP. Cada módulo de domínio importado aqui expõe
 * controllers e, no máximo, PRODUZ jobs pras filas (nunca consome).
 *
 * Deliberadamente NÃO importa: AiModule, NotificationsModule,
 * MediaWorkerModule, PdfRenderWorkerModule — esses só existem no
 * WorkerModule. Se um dia alguém importar um deles aqui por engano, o
 * teste `api-worker-split.spec.ts` (na raiz de `src/`) quebra a build.
 */
@Module({
  imports: [
    CoreModule,
    UsersModule,
    AuthModule,
    ClientsModule,
    ProjectsModule,
    PostsModule,
    MediaModule,
    ApprovalModule,
    PdfRenderModule,
  ],
})
export class ApiModule {}
