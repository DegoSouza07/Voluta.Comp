import { JobsOptions } from 'bullmq';

/**
 * Limpeza automática de jobs no Redis — sem isso, todo job completado ou
 * falho fica pra sempre como uma chave no Redis. Num sistema com volume
 * real, isso vira memória de Redis crescendo sem fim — e memória de
 * Redis é billing igual a qualquer outro serviço, se o Redis for
 * gerenciado (addon pago) e não só um container solto.
 *
 * - Sucesso: mantém só os 200 mais recentes — suficiente pra debug do
 *   tipo "os últimos X renders/análises", sem reter histórico infinito.
 * - Falha: mantém os 500 mais recentes E por até 7 dias — falha é
 *   diagnóstico, vale reter mais tempo pra investigar um problema
 *   recorrente sem precisar estar de olho no momento exato que aconteceu.
 *
 * `count` e `age` se combinam (o BullMQ aplica o mais restritivo dos
 * dois a cada job): https://docs.bullmq.io/guide/queues/auto-removal-of-jobs
 */
export const JOB_CLEANUP_DEFAULTS: Pick<JobsOptions, 'removeOnComplete' | 'removeOnFail'> = {
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 500, age: 7 * 24 * 60 * 60 },
};
