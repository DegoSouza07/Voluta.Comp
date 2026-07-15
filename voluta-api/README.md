# VOLUTA API — NestJS

Backend do Gerador de Plano Visual. **API e Worker são dois processos
separados** (mesmo código-fonte, entry points diferentes — ver seção "API
e Worker separados" abaixo), com filas assíncronas entre eles (BullMQ/Redis),
exatamente como desenhado na Etapa 1. **Compila limpo** (`npm run build`)
e tem **112 testes automatizados passando** (95 unitários + 17 e2e, sendo
11 deles contra Postgres e Redis **reais**) — tudo validado antes da
entrega, incluindo os dois processos rodando de verdade lado a lado.

**Deploy em produção → [`DEPLOY.md`](./DEPLOY.md)** (Railway, passo a passo).

## Como rodar

```bash
npm install
cp .env.example .env        # preencha OPENAI_API_KEY, STORAGE_*, etc.
docker compose up -d postgres redis   # só a infra — API e Worker rodam direto no host

npm run start:dev            # terminal 1 — API
npm run start:worker:dev     # terminal 2 — Worker

# ou, se preferir um processo só pro dia a dia:
npm run start:monolith:dev
```

API sempre em `http://localhost:3000/api/v1`, com ou sem o Worker
separado — a diferença é só quem processa os jobs das filas.

Login inicial (seed em `sql/000_init.sql`): `diego@voluta.company` / `trocar123`.

## Testes

```bash
npm run test          # 95 testes unitários (services, processors, guards, filters) — sem DB/Redis
npm run test:cov      # com relatório de cobertura
npm run test:e2e      # 17 testes de integração HTTP
```

`test:e2e` roda dois arquivos:
- `http-pipeline.e2e-spec.ts` (6 testes) — valida a config global do
  `main.ts` (pipes, filtro, prefixo/versionamento) com um Nest app mínimo,
  **sem** precisar de Postgres/Redis.
- `tenant-isolation.e2e-spec.ts` (11 testes) — sobe a `AppModule` **inteira**
  contra Postgres e Redis de verdade, faz login real (bcrypt+JWT) e prova
  por HTTP que um `client_viewer` de um cliente não enxerga dado de outro.
  **Precisa** de `DB_HOST`/`REDIS_HOST` apontando pra um banco com as
  migrations `sql/000_init.sql` e `sql/001_post_media.sql` aplicadas — o
  mesmo `docker compose up -d` do "Como rodar" resolve isso. Sem
  Postgres/Redis rodando, só esse arquivo falha (o resto da suíte
  continua passando).

### Cobertura por módulo

| Módulo | Arquivo de teste | O que valida |
|---|---|---|
| `auth` | `auth.service.spec.ts`, `jwt.strategy.spec.ts` | mensagem de erro idêntica pra user inexistente/senha errada, usuário buscado fresco a cada request |
| `common/guards` | `roles.guard.spec.ts`, **`tenant.guard.spec.ts`** | bloqueia por papel só quando `@Roles()` está presente; isolamento por `client_id` |
| `common/filters` | `http-exception.filter.spec.ts` | nunca vaza stack trace de erro não tratado |
| `clients` | `clients.service.spec.ts` | slug duplicado, soft-delete |
| `projects` | `projects.service.spec.ts` | slug público não muda ao republicar |
| `posts` | `posts.service.spec.ts` | **reorder em duas fases** (a constraint UNIQUE), weekday derivado |
| `media` | `media.service.spec.ts`, `media-processing.processor.spec.ts` | slot de mídia por kind+orderIndex, reset de variantes ao reenviar, IA disparada só pela mídia primária |
| `ai` | `ai.service.spec.ts`, `ai-analysis.processor.spec.ts` | Structured Outputs, seleção da mídia primária por formato |
| `pdf-render` | `pdf-data.mapper.spec.ts`, `pdf-render.service.spec.ts`, `pdf-render.processor.spec.ts` | regressão do bug do ícone de play, pool de browser reutilizado, cor de marca injetada |
| `approval` | `approval.service.spec.ts` | webhook sempre enfileirado, nunca síncrono |
| `notifications` | `webhook-notify.processor.spec.ts` | formatação da mensagem, erro relançado pro retry do BullMQ |
| `users` | `users.service.spec.ts` | passwordHash só sai com `addSelect` explícito |
| **e2e** | `tenant-isolation.e2e-spec.ts` | **client_viewer isolado por client_id, fim a fim, com banco real** |

## API e Worker separados

Os dois processos rodam a partir do MESMO código-fonte, cada um com seu
próprio entry point:

```
src/main.ts            -> ApiModule   (só HTTP, zero fila consumida)
src/worker.ts           -> WorkerModule (zero HTTP, só consumidores de fila)
src/main-monolith.ts    -> AppModule    (os dois juntos — só pra dev local)
```

```bash
# Produção / qualquer ambiente com Postgres+Redis de verdade acessíveis:
npm run start:prod           # API
npm run start:worker:prod    # Worker (processo separado, escala independente)

# Dev local (dois terminais):
npm run start:dev
npm run start:worker:dev

# Dev local (um terminal só, API+Worker no mesmo processo):
npm run start:monolith:dev
```

`ApiModule` importa `ClientsModule`, `ProjectsModule`, `PostsModule`,
`MediaModule` (só o controller + produtor de fila), `PdfRenderModule` (só
o controller), `ApprovalModule`, `AuthModule`, `UsersModule`.
`WorkerModule` importa `MediaWorkerModule`, `AiModule`,
`PdfRenderWorkerModule`, `NotificationsModule` — os consumidores de fila
de verdade (Sharp e Puppeteer, as duas peças mais pesadas de CPU do
sistema, só existem no processo do Worker).

### Dois bugs reais, encontrados só rodando os processos de verdade

Nenhum teste (unitário ou e2e) pegaria os dois problemas abaixo — só
apareceram executando `node dist/worker.js` de verdade contra Postgres
real, depois da separação:

1. **Metadata de entidade faltando**: `WorkerModule` não carrega
   `ClientsModule`/`UsersModule` (não precisa de CRUD de cliente/usuário),
   mas `Project` tem relações `@ManyToOne` pra `Client` e `User`. O
   TypeORM precisa da metadata dessas duas entidades presente em algum
   `TypeOrmModule.forFeature()` do grafo pra resolver a relação — mesmo
   que o Worker nunca escreva nelas. Sem isso: `Entity metadata for
   Project#client was not found`, e o processo nem sobe. Corrigido
   registrando `TypeOrmModule.forFeature([Client, User])` direto no
   `WorkerModule`.
2. Confirmei manualmente (fora do Jest) que `main.js` sobe só as rotas
   HTTP e `worker.js` sobe só os consumidores — logs de boot de cada
   processo comparados lado a lado, nenhum módulo de fila aparece no log
   da API e vice-versa.

### Deploy (Docker)

`Dockerfile` na raiz builda uma imagem única (API e Worker usam a mesma
imagem, só o `command` no `docker-compose.yml` muda). Inclui Chromium do
sistema via `apt`, não o baixado pelo `puppeteer` no postinstall — mais
previsível de buildar em CI/CD do que depender de
`storage.googleapis.com` estar acessível no momento do build.

```bash
docker compose --profile full up -d              # API + Worker + Postgres + Redis
docker compose --profile full up -d --scale worker=3  # escala só o worker
```

## Guard de tenant — fechado

`TenantGuard` (`src/common/guards/tenant.guard.ts`) isola dado por
cliente pra usuários `client_viewer`. Sem ele, qualquer pessoa autenticada
conseguia ver o projeto/post de OUTRO cliente só trocando o UUID na URL —
o `JwtAuthGuard` só prova QUEM é a pessoa, nunca garantiu O QUE ela pode
ver.

- `voluta_admin`/`voluta_editor` sempre passam direto — numa instância de
  agência única, a equipe da Voluta enxerga todos os clientes por design.
- `client_viewer` só acessa recursos (`clients/:id`, `projects/:id`,
  `projects/by-client/:clientId`, `posts/:id`, etc.) que pertencem ao
  próprio `client_id`. Qualquer outro retorna **403**, nunca 404 — não
  confirma nem nega a existência do recurso pra quem não tem acesso.
- Marcação declarativa via `@TenantResource(TenantResourceType.PROJECT, 'id')`
  no handler — mesmo padrão do `@Roles()`.
- `GET /clients` (lista completa) e toda mutação (`POST`/`PATCH`) ficaram
  restritas a `voluta_admin`/`voluta_editor` — um `client_viewer` não tem
  por que listar as outras marcas da agência nem editar projeto.

### Pegadinha real do NestJS que vale registrar

`@UseGuards(TenantGuard)` referenciado por **classe** só resolve as
dependências do guard **dentro do módulo do controller que o usa** — Nest
não segue `imports`/`exports` de outro módulo pra isso, mesmo com
`@Global()`. Minha primeira tentativa foi um `TenantAccessModule`
compartilhado exportando o guard pronto; funcionava nos testes unitários
(guard instanciado manualmente) mas quebrava só no e2e real, com um erro
de DI genuíno. A correção foi declarar `TenantGuard` como provider local
em cada módulo que o usa (`ClientsModule`, `ProjectsModule`,
`PostsModule`, `MediaModule`), com `Project`/`Post` registrados via
`TypeOrmModule.forFeature()` ali também. Isso só apareceu rodando contra
uma `AppModule` real montada pelo `Test.createTestingModule` — nenhum
teste unitário (que instancia o guard manualmente com `new TenantGuard(...)`)
pegaria esse tipo de erro de fiação entre módulos.

### Bug real encontrado só com Postgres de verdade

A entidade `User` tinha uma relação `@ManyToOne(() => Client)` **sem**
`@JoinColumn`. O TypeORM, nesse caso, cria uma coluna estrangeira
implícita própria (`clientId`, sem underscore) por baixo dos panos — que
não existe no Postgres, porque a coluna real é `client_id` (já mapeada
manualmentte no campo `clientId: string | null` logo acima). Toda query
que tocasse a relação `user.client` quebrava com `column user.clientId
does not exist`. Só apareceu rodando o e2e contra Postgres real, porque
os testes unitários usam repository mockado — `findOne()` simplesmente
retorna o que você mandou, nunca gera SQL de verdade. **Corrigido** com
`@JoinColumn({ name: 'client_id' })` apontando pra mesma coluna física.

## post_media — a lacuna de schema, resolvida

A entrega anterior guardava 1 mídia por post (`posts.media_original_url`),
o que não representava Reel (2 mídias: cover != frame do vídeo) nem
Carrossel (N slides) corretamente. Migration `sql/001_post_media.sql`:

```sql
CREATE TYPE post_media_kind AS ENUM ('cover', 'reel', 'slide');

CREATE TABLE post_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  kind post_media_kind NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  original_url TEXT NOT NULL,
  variants JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_post_media_slot UNIQUE (post_id, kind, order_index)
);
```

`posts.media_original_url` e `posts.media_variants` foram **removidos**
(a mesma migration faz o `DROP COLUMN`). API de upload nova:

```
POST /projects/:id/posts                       -> cria o "casco" do post (formato + posição)
POST /posts/:postId/media/upload-url            -> body: { kind, orderIndex, filename, contentType }
POST /posts/:postId/media/:postMediaId/confirm-upload
```

- **Reel**: 2 chamadas — `kind=cover, orderIndex=0` e `kind=reel, orderIndex=0`.
- **Carrossel**: N chamadas — `kind=slide, orderIndex=0..N-1`.
- **Estático**: 1 chamada — `kind=slide, orderIndex=0`.

A IA (Etapa 3) só é disparada quando a **mídia primária** do post termina
de processar (cover pro Reel, slide 0 pro Carrossel/Estático) — decisão
deliberada pra não gerar N chamadas de IA redundantes pro mesmo post.

## Estrutura

```
src/
├── main.ts                  # entry point da API (produção)
├── worker.ts                 # entry point do Worker (produção)
├── main-monolith.ts           # entry point API+Worker juntos (só dev local)
├── app.module.ts               # AppModule = ApiModule + WorkerModule (monólito)
├── api.module.ts                # só os módulos HTTP-facing
├── worker.module.ts              # só os módulos consumidores de fila
├── core.module.ts                 # Config/Postgres/Redis, compartilhado pelos dois acima
├── common/
│   ├── enums/                  # espelham 1:1 os ENUMs do Postgres (Etapa 2)
│   ├── decorators/               # @Roles(), @CurrentUser(), @TenantResource()
│   ├── guards/                    # JwtAuthGuard, RolesGuard, TenantGuard
│   ├── filters/                   # HttpExceptionFilter (formato de erro único)
│   └── testing/                    # mock-repository.ts (helper usado em todos os *.spec.ts)
├── config/
│   ├── typeorm.config.ts
│   └── bullmq.config.ts
└── modules/
    ├── auth/                   # login (JWT), me
    ├── users/                  # sem controller público — só suporte ao auth
    ├── clients/                 # CRUD de clientes + TenantGuard no findOne
    ├── projects/                 # CRUD de projetos + publish() + TenantGuard
    ├── posts/                     # CRUD de posts + reorder() em lote + TenantGuard
    ├── media/
    │   ├── entities/post-media.entity.ts      # 1 post : N mídias (cover/reel/slide)
    │   ├── storage.service.ts                 # abstração S3-compatible (Supabase/R2)
    │   ├── media.module.ts                    # API — controller + produtor de fila
    │   ├── media-worker.module.ts              # Worker — consumidor (Sharp)
    │   └── processors/media-processing.processor.ts
    ├── ai/                      # 100% Worker — sem controller, só consumidor de ai-analysis
    │   ├── ai.service.ts             # chama GPT-4o Vision (Structured Outputs)
    │   └── processors/ai-analysis.processor.ts
    ├── pdf-render/
    │   ├── templates/                 # .hbs + icons.ts copiados da Etapa 5, validados
    │   ├── styles/                    # design-system.css + fonts.generated.css (base64)
    │   ├── pdf-data.mapper.ts         # traduz Project/Client/Post/PostMedia -> contexto do template
    │   ├── pdf-render.service.ts      # Handlebars + Puppeteer, browser pool
    │   ├── pdf-render.module.ts       # API — só o controller que enfileira
    │   ├── pdf-render-worker.module.ts # Worker — mapper + service + processor
    │   └── processors/pdf-render.processor.ts
    ├── approval/
    │   └── public.controller.ts      # UNICO controller sem JwtAuthGuard —
    │                                     protegido só pelo slug público (Etapa 6)
    └── notifications/            # 100% Worker — sem controller, só consumidor de webhook-notify
        └── processors/webhook-notify.processor.ts
```

## Fluxo ponta a ponta já ligado

```
POST /projects/:id/posts                -> cria post draft (formato + posição)
POST /posts/:id/media/upload-url        -> cria slot de PostMedia + URL pré-assinada
[front faz PUT direto no bucket]
POST /posts/:id/media/:mediaId/confirm-upload  -> enqueue(media-processing)
   media-processing.processor            -> gera 3 variantes -> se for a mídia primária, enqueue(ai-analysis)
   ai-analysis.processor                  -> chama GPT-4o -> preenche caption/editoria/etc
PATCH /projects/:id/posts/reorder       -> grid interativo (Etapa 4)
POST  /projects/:id/render-pdf          -> enqueue(pdf-render)
   pdf-render.processor                   -> PdfDataMapper -> Handlebars -> Puppeteer -> upload -> attachRenderedPdf
PATCH /projects/:id/publish             -> gera public_slug
GET  /public/plano/:slug                -> portal do cliente (Etapa 6, sem login)
POST /public/posts/:id/approval         -> aprova/pede ajuste -> enqueue(webhook-notify)
   webhook-notify.processor               -> posta no Slack
```

Todas as rotas acima (exceto `/public/*`) passam por
`JwtAuthGuard -> RolesGuard -> TenantGuard`, nessa ordem — precisa estar
autenticado, ter o papel certo, e (se for `client_viewer`) ser dono do
recurso.

## Decisões que valem destacar

- **`ApprovalService` grava o evento e enfileira o Slack, mas nunca chama
  o Slack de forma síncrona** — testado em `approval.service.spec.ts`.
- **`PostsService.reorder` faz o update em duas fases** — testado em
  `posts.service.spec.ts`.
- **`media-processing.processor` só dispara a IA pela mídia primária** —
  testado com os 3 formatos em `media-processing.processor.spec.ts`.
- **`PdfRenderService` compila os templates e registra os partials de
  ícone uma única vez em `onModuleInit`**, e reusa 1 instância de browser
  entre renders.
- **`TenantGuard` retorna 403 sempre, nunca 404**, mesmo quando o recurso
  não existe pro `client_viewer` errado — não dá pra descobrir por
  enumeração se um projeto existe ou não sondando IDs.
- **API e Worker são processos separados** (`src/main.ts` vs
  `src/worker.ts`, ver seção acima) — Puppeteer e processamento de imagem
  não competem por CPU com as requests HTTP, e cada um escala
  independente.

## Pendências conhecidas (próximos passos)

Nenhuma pendência estrutural aberta no momento.

1. O e2e real (`tenant-isolation.e2e-spec.ts`) precisa de Postgres/Redis
   no ar pra rodar — não entra no pipeline de CI sem esse setup (o
   `docker-compose.yml` já resolve isso localmente e é reaproveitável
   num job de CI com serviços).
2. Se o volume um dia justificar, dá pra migrar de "dois entry points no
   mesmo `src/`" pro modo Monorepo de verdade do Nest (`apps/api`,
   `apps/worker`, `libs/shared`) — hoje não compensa o custo de reorganizar
   tudo, mas a divisão lógica (ApiModule/WorkerModule) já está pronta pra
   essa migração ser só mecânica quando fizer sentido.
