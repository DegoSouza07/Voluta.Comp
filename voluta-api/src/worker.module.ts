import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreModule } from './core.module';
import { Client } from './modules/clients/entities/client.entity';
import { User } from './modules/users/entities/user.entity';

import { MediaWorkerModule } from './modules/media/media-worker.module';
import { AiModule } from './modules/ai/ai.module';
import { PdfRenderWorkerModule } from './modules/pdf-render/pdf-render-worker.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

/**
 * Processo de Worker — sem HTTP, só consumidores de fila (BullMQ Workers,
 * via @Processor). Roda Sharp (processamento de imagem) e Puppeteer
 * (renderização de PDF), as duas peças mais pesadas de CPU do sistema —
 * a razão de existir essa separação (Etapa 1). Escala independente da API:
 * sobe mais réplicas de worker sem tocar na API, e vice-versa.
 */
@Module({
  imports: [
    CoreModule,
    // Client e User não têm CRUD próprio aqui (isso é coisa de ClientsModule/
    // UsersModule, que o worker não carrega) — mas Project.client e
    // Project.creator são relações pra essas entidades, e o TypeORM precisa
    // da metadata delas presente no grafo pra resolver a relação, mesmo que
    // o worker nunca escreva nelas diretamente. Sem isso: "Entity metadata
    // for Project#client was not found" — só aparece rodando o processo de
    // verdade (`node dist/worker.js`), nenhum teste unitário/e2e com
    // repository mockado ou com a AppModule inteira carregada pegaria isso.
    TypeOrmModule.forFeature([Client, User]),
    MediaWorkerModule,
    AiModule,
    PdfRenderWorkerModule,
    NotificationsModule,
  ],
})
export class WorkerModule {}
