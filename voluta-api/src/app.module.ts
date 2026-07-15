import { Module } from '@nestjs/common';
import { ApiModule } from './api.module';
import { WorkerModule } from './worker.module';

/**
 * Monólito — API + Worker no mesmo processo. Existe só pra desenvolvimento
 * local (`npm run start:dev`, um único processo é mais simples no dia a
 * dia) e pros testes (o e2e real sobe a AppModule inteira pra poder testar
 * o fluxo ponta a ponta numa chamada só). Em produção, os processos
 * separados (`main.ts` -> ApiModule, `worker.ts` -> WorkerModule) que
 * devem rodar de fato — ver README, seção "API e Worker separados".
 */
@Module({
  imports: [ApiModule, WorkerModule],
})
export class AppModule {}
