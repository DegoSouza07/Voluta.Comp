import { registerAs } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Config do Redis usado pelas filas (media-processing, ai-analysis,
 * pdf-render, webhook-notify). Ver Etapa 1 — nada síncrono e lento roda
 * dentro de uma request HTTP.
 *
 * Suporta REDIS_URL (connection string única — é assim que Railway/Render
 * injetam a credencial do addon de Redis automaticamente). O tipo
 * `ConnectionOptions` do BullMQ NÃO aceita string crua — só objeto de
 * opções ou uma instância de cliente ioredis já pronta, por isso
 * instanciamos o client aqui em vez de só repassar a URL.
 *
 * `maxRetriesPerRequest: null` é exigido pelo BullMQ pra conexões usadas
 * por Worker — sem isso, o ioredis desiste de comandos bloqueantes
 * (BRPOPLPUSH etc.) antes da hora.
 */
export default registerAs('redis', () => ({
  connection: process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
    : new Redis({
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
      }),
}));
