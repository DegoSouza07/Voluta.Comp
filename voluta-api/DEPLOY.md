# Deploy na Railway

3 serviços num projeto Railway: **Postgres** e **Redis** (addons gerenciados)
+ **API** e **Worker** (a mesma imagem Docker, `Custom Start Command`
diferente em cada um). ~20 min a primeira vez.

## 0. Antes de começar

- Repositório no GitHub com este código (`DegoSouza07/Voluta.Comp` ou o
  nome que você já criou — dá pra ver no VS Code que o projeto já tá
  versionado).
- Conta na [railway.app](https://railway.app) (dá pra logar com GitHub).
- Sua `OPENAI_API_KEY` em mãos.
- Credenciais de um bucket S3-compatible (Supabase Storage, já que é o
  que você usa nos outros projetos, ou Cloudflare R2) — endpoint, bucket,
  access key, secret key, URL pública.

## 1. Criar o projeto e subir o código

1. **New Project** → **Deploy from GitHub repo** → selecione o repositório.
2. Railway cria automaticamente o primeiro serviço a partir do
   `Dockerfile` na raiz (ele detecta sozinho, não precisa configurar nada
   ainda). **Renomeie esse serviço pra `api`** (clique no nome no topo do
   card do serviço).

## 2. Adicionar Postgres e Redis

No canvas do projeto, **New** → **Database** → **Add PostgreSQL**.
Repita: **New** → **Database** → **Add Redis**.

Cada um vira um serviço próprio no mesmo projeto, com variáveis geradas
automaticamente (`DATABASE_URL`, `REDIS_URL`, entre outras) — é assim que
o `typeorm.config.ts` e o `bullmq.config.ts` do projeto já sabem se
conectar (ver Etapa "API e Worker separados" no README — os dois configs
foram atualizados pra aceitar `DATABASE_URL`/`REDIS_URL` prontos, sem
precisar copiar host/porta/senha na mão).

## 3. Configurar o serviço `api`

Clique no serviço `api` → aba **Variables** → adicione (uma por linha,
Railway tem um editor de "raw" que aceita colar tudo de uma vez):

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=<gere um valor forte — ex: openssl rand -hex 32>
JWT_EXPIRES_IN=8h
OPENAI_API_KEY=<sua chave>
STORAGE_ENDPOINT=<endpoint do seu bucket>
STORAGE_REGION=auto
STORAGE_BUCKET=<nome do bucket>
STORAGE_ACCESS_KEY=<access key>
STORAGE_SECRET_KEY=<secret key>
STORAGE_PUBLIC_BASE_URL=<url pública do bucket>
SLACK_WEBHOOK_URL=<opcional>
CORS_ORIGIN=<domínio do front-end, quando existir — * funciona por enquanto>
PORT=3000
```

`${{Postgres.DATABASE_URL}}` e `${{Redis.REDIS_URL}}` são referências —
a Railway substitui automaticamente pelo valor real do addon, e mantém
sincronizado se a credencial rotacionar. Não copie o valor manualmente.

Aba **Settings** → **Deploy**:
- **Custom Start Command**: `node dist/main`
- **Pre-Deploy Command**: `node scripts/migrate.js` — aplica
  `sql/000_init.sql` e `sql/001_post_media.sql` antes de cada deploy.
  Idempotente (ver `scripts/migrate.js`), então rodar de novo em todo
  deploy não causa problema.

Aba **Settings** → **Networking** → **Generate Domain** — é a URL
pública da API (`https://algo.up.railway.app`).

## 4. Criar o serviço `worker`

No canvas, **New** → **GitHub Repo** → mesmo repositório de novo. Renomeie
pra `worker`.

**Variables**: as MESMAS variáveis do passo 3, **exceto** `CORS_ORIGIN` e
`PORT` (o worker não serve HTTP, não precisa delas). Forma mais rápida:
copie tudo do serviço `api` (menu **⋮** → **Copy Variables**) e apague
essas duas depois.

**Settings** → **Deploy**:
- **Custom Start Command**: `node dist/worker`
- **Pre-Deploy Command**: `node scripts/migrate.js` (mesma migration —
  seguro rodar duas vezes, é idempotente; garante que o worker nunca sobe
  antes do schema existir, mesmo que os dois serviços façam deploy quase
  ao mesmo tempo)

**Não gere domínio pra esse serviço** — ele não recebe request HTTP
nenhuma, só consome fila.

## 5. Verificar

```bash
curl https://<seu-dominio>.up.railway.app/api/v1/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"diego@voluta.company","password":"trocar123"}'
```

Deve devolver `{"accessToken": "..."}`. Se dá 401, confira se o
`Pre-Deploy Command` do serviço `api` realmente rodou (aba **Deployments**
→ clique no deploy → veja o log — deve aparecer `[migrate] concluído`
antes de `VOLUTA API rodando em...`).

Nos logs do serviço `worker`, procure por:
```
Templates de PDF compilados e ícones registrados.
Worker rodando — consumindo media-processing, ai-analysis, pdf-render, webhook-notify.
```

**Troque a senha do usuário seed** (`diego@voluta.company` /
`trocar123`) assim que confirmar que o login funciona — ela só existe pra
validar que o deploy funcionou de ponta a ponta.

## 6. Deploy contínuo

Qualquer `git push` na branch conectada dispara rebuild+redeploy dos dois
serviços automaticamente (cada um builda a partir do mesmo Dockerfile,
independente).

## Escalar o worker

Se a fila de renderização de PDF começar a acumular (você vai ver isso
crescendo nos logs, ou dá pra plugar o Bull Board depois se quiser um
dashboard visual), escale só o worker, sem tocar na API:

Serviço `worker` → **Settings** → **Deploy** → **Replicas** → aumente o
número. BullMQ já distribui os jobs entre as réplicas automaticamente
(cada job é processado uma vez só, por qualquer worker livre).

## Troubleshooting

| Sintoma | Causa provável |
|---|---|
| `api` sobe mas todo endpoint dá 500 | `Pre-Deploy Command` não rodou ou falhou — confira o log do deploy |
| `worker` reinicia em loop | Confira `OPENAI_API_KEY`/`STORAGE_*` — `AiService`/`StorageService` usam `getOrThrow()`, o processo não sobe sem essas variáveis |
| PDF não gera, sem erro nenhum | Confira se `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` está de fato no ambiente — já vem fixado no `Dockerfile`, não precisa setar de novo nas Variables |
| `column ... does not exist` | Migration não rodou nesse banco — rode manualmente uma vez: `railway run --service api node scripts/migrate.js` |
