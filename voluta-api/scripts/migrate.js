#!/usr/bin/env node
// scripts/migrate.js
//
// Runner de migration mínimo, sem dependência de nenhuma CLI externa (nem
// psql, nem typeorm migration:run) — só precisa do driver `pg`, que já é
// dependência transitiva do TypeORM. Aplica cada .sql de sql/ em ordem
// alfabética, uma vez só cada, registrando o que já rodou numa tabela
// schema_migrations. Idempotente: rodar de novo não reaplica nada.
//
// Por que não usar as migrations nativas do TypeORM: os arquivos em sql/
// já existiam como fonte única de verdade do schema (usados também pelo
// docker-compose local, via docker-entrypoint-initdb.d) — duplicar isso
// como TypeORM migrations classes seria manter a mesma coisa em dois
// formatos. Esse runner é a ponte mínima pra aplicar os MESMOS arquivos
// num Postgres gerenciado (Railway, Render, Supabase) que não tem
// docker-entrypoint-initdb.d.
//
// Uso:
//   node scripts/migrate.js
//   DATABASE_URL=postgres://... node scripts/migrate.js   (produção)
//
// Usado como "Pre-Deploy Command" nos serviços da Railway (ver DEPLOY.md).

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const SQL_DIR = path.join(__dirname, '..', 'sql');

function buildClientConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'voluta',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };
}

async function main() {
  const client = new Client(buildClientConfig());
  await client.connect();
  console.log(`[migrate] conectado em ${process.env.DATABASE_URL ? '(DATABASE_URL)' : process.env.DB_HOST || 'localhost'}`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const files = fs
    .readdirSync(SQL_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const { rows: applied } = await client.query('SELECT filename FROM schema_migrations');
  const appliedSet = new Set(applied.map((r) => r.filename));

  let appliedCount = 0;
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`[migrate] ${file} — já aplicada, pulando`);
      continue;
    }

    const sql = fs.readFileSync(path.join(SQL_DIR, file), 'utf-8');
    console.log(`[migrate] aplicando ${file}...`);

    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      appliedCount += 1;
      console.log(`[migrate] ${file} — OK`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[migrate] ${file} — FALHOU:`, err.message);
      await client.end();
      process.exit(1);
    }
  }

  console.log(`[migrate] concluído — ${appliedCount} migration(s) nova(s) aplicada(s), ${files.length - appliedCount} já estavam em dia.`);
  await client.end();
}

main().catch((err) => {
  console.error('[migrate] erro fatal:', err);
  process.exit(1);
});
