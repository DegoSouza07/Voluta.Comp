# Plano Visual — Painel (voluta-web)

Front-end React + TypeScript + Vite pra operar a VOLUTA API. Login,
clientes, projetos, posts, upload de mídia e geração de PDF — tudo pela
mesma API que já está no ar na Railway.

## Estrutura

```
src/
├── lib/
│   ├── api.ts             # cliente HTTP tipado — espelha o contrato real da API
│   └── auth-context.tsx    # token JWT em localStorage, guarda de rota
├── components/
│   ├── ui.tsx               # Button, Field, Card, Badge, ErrorBanner
│   ├── Layout.tsx            # sidebar + shell de página
│   ├── Modal.tsx              # modal genérico
│   └── ProtectedRoute.tsx      # redireciona pro /login se não autenticado
├── pages/
│   ├── LoginPage.tsx          # tela de entrada (mesma identidade visual do PDF)
│   ├── ClientsPage.tsx         # lista + criação de clientes
│   ├── ClientDetailPage.tsx     # projetos de um cliente
│   ├── ProjectDetailPage.tsx     # posts de um projeto + publicar + gerar PDF
│   └── PostDetailPage.tsx         # upload de mídia por slot + campos da IA
└── styles/tokens.css          # design tokens — MESMA identidade do PDF (Etapa 5)
```

## Rodar localmente

Precisa de Node instalado (v20+). Se não tiver na sua máquina, pula pra
"Deploy" abaixo — o GitHub Actions builda sem você precisar de Node local.

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Deploy (GitHub Actions -> GitHub Pages)

Zero Node necessário na sua máquina — o build roda no GitHub, na nuvem.

### 1. Mover o workflow pro lugar certo

O arquivo `.github-workflow-to-move/deploy-web.yml` (nessa entrega) precisa
ir pra RAIZ do repositório (não dentro de `voluta-web/`), no caminho:

```
.github/workflows/deploy-web.yml
```

Como o repositório já tem `voluta-api/` numa subpasta, a estrutura final
fica:

```
Voluta.Comp/                    (raiz do repo)
├── .github/
│   └── workflows/
│       └── deploy-web.yml       <- move pra ca
├── voluta-api/
└── voluta-web/                  <- esse projeto entra aqui
```

### 2. Ativar GitHub Pages via Actions

No GitHub: Settings -> Pages -> Build and deployment -> Source -> troca
pra "GitHub Actions" (nao "Deploy from a branch" - e uma opcao diferente,
mais nova).

### 3. Dar push

```bash
git add voluta-web .github/workflows/deploy-web.yml
git commit -m "Adiciona painel web (voluta-web) + deploy automatico"
git push
```

Isso dispara o workflow automaticamente. Acompanha em "Actions" (aba do
GitHub, no topo do repositorio) - leva uns 2-3 minutos. Quando terminar,
o site fica em https://degosouza07.github.io/Voluta.Comp/

### Atualizacoes futuras

Todo `git push` que tocar em `voluta-web/` builda e publica de novo
sozinho - nao precisa repetir nada disso.

## Login inicial

Mesmo usuario da API: diego@voluta.company - use a senha que voce ja
trocou (nao e mais trocar123).
