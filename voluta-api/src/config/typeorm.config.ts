import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Config centralizada do Postgres.
 *
 * Suporta dois formatos:
 * - DATABASE_URL (uma única connection string) — é assim que Railway,
 *   Render, Heroku e Fly injetam a credencial do addon de Postgres
 *   automaticamente. Prioridade sobre as variáveis individuais.
 * - DB_HOST/DB_PORT/DB_USER/... — usado em dev local (.env) e no
 *   docker-compose, onde não existe essa string pronta.
 *
 * Em dev, synchronize fica ligado só se DB_SYNC=true explicitamente —
 * nunca por padrão, pra não mascarar a necessidade de migrations reais
 * (ver sql/000_init.sql, sql/001_post_media.sql, e scripts/migrate.js).
 */
export default registerAs('database', (): TypeOrmModuleOptions => {
  const base = {
    type: 'postgres' as const,
    autoLoadEntities: true,
    synchronize: process.env.DB_SYNC === 'true',
    logging: process.env.DB_LOGGING === 'true',
  };

  if (process.env.DATABASE_URL) {
    return {
      ...base,
      url: process.env.DATABASE_URL,
      // Provedores gerenciados (Railway/Render/Heroku) servem Postgres
      // atrás de TLS com certificado não assinado por uma CA pública —
      // rejectUnauthorized:false é o padrão aceito pra isso, não uma
      // gambiarra de segurança (a conexão continua criptografada).
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    };
  }

  return {
    ...base,
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'voluta',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };
});
