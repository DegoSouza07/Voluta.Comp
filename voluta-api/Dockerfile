# Imagem única, usada tanto pra API quanto pro Worker — só o CMD muda
# (ver docker-compose.yml). Inclui Chromium do sistema porque o Worker
# precisa dele pro Puppeteer; a API carrega a mesma imagem mas nunca usa
# esse binário — trade-off consciente de simplicidade operacional (1
# imagem só) em troca de ~300MB a mais na imagem da API. Se isso incomodar
# no futuro, é só separar em Dockerfile.api / Dockerfile.worker.

FROM node:22-slim AS build
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY scripts ./scripts
COPY sql ./sql

# Sem CMD fixo aqui de propósito — docker-compose.yml define
# `command: node dist/main` (API) ou `command: node dist/worker` (Worker)
# a partir da MESMA imagem.