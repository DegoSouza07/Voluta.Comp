# Imagem única, usada tanto pra API quanto pro Worker — só o CMD muda
# (ver docker-compose.yml). Inclui Chromium do sistema porque o Worker
# precisa dele pro Puppeteer; a API carrega a mesma imagem mas nunca usa
# esse binário — trade-off consciente de simplicidade operacional (1
# imagem só) em troca de ~300MB a mais na imagem da API. Se isso incomodar
# no futuro, é só separar em Dockerfile.api / Dockerfile.worker.

FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app

# Chromium do sistema (não o baixado pelo puppeteer no postinstall) — mais
# leve e mais fácil de manter atualizado via apt do que via o download do
# pacote puppeteer, que depende de storage.googleapis.com estar acessível
# no momento do build (ver nota no README sobre rede corporativa restrita).
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

# Sem CMD fixo aqui de propósito — docker-compose.yml define
# `command: node dist/main` (API) ou `command: node dist/worker` (Worker)
# a partir da MESMA imagem.
