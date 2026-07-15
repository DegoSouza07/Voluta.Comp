import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import puppeteer, { Browser } from 'puppeteer';
import { Project } from '../projects/entities/project.entity';
import { PostFormat } from '../../common/enums/post-format.enum';
import { PdfDataMapper } from './pdf-data.mapper';
import { icons } from './templates/icons';

const TEMPLATES_DIR = path.join(__dirname, 'templates');
const STYLES_DIR = path.join(__dirname, 'styles');

// Chromium headless é um processo de vida longa nesse worker (mesma
// instância reutilizada entre jobs — ver getBrowser()). Mesmo fechando
// toda `page` corretamente, processos V8 de longa duração acumulam
// fragmentação de heap e memória "presa" que só volta reiniciando o
// processo do zero. Reciclar a cada N renders é mais barato e mais
// previsível do que perseguir cada vazamento individual do Chromium.
const MAX_RENDERS_BEFORE_RECYCLE = 50;

// Um job travado (página que nunca termina de carregar, PDF que nunca
// finaliza) segura memória do worker indefinidamente — e é RAM sendo
// cobrada sem produzir nada. Timeout duro garante que o job falha (e o
// BullMQ re-tenta, conforme defaultJobOptions) em vez de vazar recurso
// pra sempre. Mantido abaixo do lockDuration configurado no @Processor
// (90s) — ver pdf-render.processor.ts — pra nunca deixar o BullMQ marcar
// o job como travado e mandar OUTRO worker processar o mesmo render.
const RENDER_TIMEOUT_MS = 45_000;

/**
 * Composição HTML → PDF via Puppeteer. Mesma estrutura validada no
 * render-test.js da Etapa 5 (cover + grid + N posts, template por
 * `post.format`), só que agora lendo dado real do Postgres via
 * PdfDataMapper em vez de mock JSON.
 */
@Injectable()
export class PdfRenderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfRenderService.name);
  private browser: Browser | null = null;
  private rendersSinceLaunch = 0;
  private launchingBrowser: Promise<Browser> | null = null;

  private coverTemplate!: HandlebarsTemplateDelegate;
  private gridTemplate!: HandlebarsTemplateDelegate;
  private postTemplatesByFormat!: Record<PostFormat, HandlebarsTemplateDelegate>;
  private fontsCss = '';
  private designSystemCss = '';

  constructor(
    private readonly mapper: PdfDataMapper,
    private readonly config: ConfigService,
  ) {}

  // Compila os templates e registra os partials de ícone UMA VEZ no boot —
  // não a cada job (ver pendência #3 apontada no README anterior).
  onModuleInit(): void {
    for (const [name, svg] of Object.entries(icons)) {
      Handlebars.registerPartial(name, svg);
    }

    const read = (dir: string, file: string) => fs.readFileSync(path.join(dir, file), 'utf-8');

    this.coverTemplate = Handlebars.compile(read(TEMPLATES_DIR, 'cover.hbs'));
    this.gridTemplate = Handlebars.compile(read(TEMPLATES_DIR, 'grid.hbs'));
    this.postTemplatesByFormat = {
      [PostFormat.REEL]: Handlebars.compile(read(TEMPLATES_DIR, 'post-reel.hbs')),
      [PostFormat.CARROSSEL]: Handlebars.compile(read(TEMPLATES_DIR, 'post-carrossel.hbs')),
      [PostFormat.ESTATICO]: Handlebars.compile(read(TEMPLATES_DIR, 'post-estatico.hbs')),
    };

    this.fontsCss = read(STYLES_DIR, 'fonts.generated.css');
    this.designSystemCss = read(STYLES_DIR, 'design-system.css');

    this.logger.log('Templates de PDF compilados e ícones registrados.');
  }

  // Chamado automaticamente pelo Nest no shutdown (SIGTERM/SIGINT), desde
  // que `app.enableShutdownHooks()` esteja ligado no bootstrap — ver
  // src/worker.ts. É isso que garante que NENHUM processo do Chromium
  // fica órfão quando o processo é reiniciado (deploy, crash controlado,
  // scale down).
  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      this.logger.log('Encerrando o Chromium (shutdown do processo)...');
      await this.browser.close().catch((err) => this.logger.warn(`Erro ao fechar o browser: ${err.message}`));
      this.browser = null;
    }
  }

  // Pool de 1 browser reutilizado entre jobs — evita o custo de subir um
  // Chromium novo a cada render (Etapa 5) — mas reciclado periodicamente
  // (ver MAX_RENDERS_BEFORE_RECYCLE) e protegido contra lançamentos
  // concorrentes duplicados (dois jobs chegando ao mesmo tempo com
  // `this.browser` ainda nulo não podem cada um subir seu próprio
  // Chromium — é exatamente esse tipo de corrida que dobra o consumo de
  // RAM sem nenhum erro visível nos logs).
  private async getBrowser(): Promise<Browser> {
    if (this.browser?.connected && this.rendersSinceLaunch < MAX_RENDERS_BEFORE_RECYCLE) {
      return this.browser;
    }

    if (this.browser) {
      this.logger.log(
        `Reciclando o Chromium após ${this.rendersSinceLaunch} renders (evita memory creep de processo de vida longa).`,
      );
      const staleBrowser = this.browser;
      this.browser = null;
      await staleBrowser.close().catch((err) => this.logger.warn(`Erro ao fechar browser reciclado: ${err.message}`));
    }

    if (!this.launchingBrowser) {
      this.launchingBrowser = puppeteer
        .launch({
          headless: true,
          executablePath: this.config.get<string>('PUPPETEER_EXECUTABLE_PATH') || undefined,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // usa /tmp em vez de /dev/shm — containers geralmente têm /dev/shm minúsculo (64MB), Chromium trava sem isso
            '--disable-gpu',            // sem GPU disponível no container, e headless não precisa dela
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-sync',
            '--metrics-recording-only',
            '--mute-audio',
            '--no-first-run',
          ],
        })
        .finally(() => {
          this.launchingBrowser = null;
        });
    }

    this.browser = await this.launchingBrowser;
    this.rendersSinceLaunch = 0;
    return this.browser;
  }

  async renderProjectToPdf(project: Project): Promise<Buffer> {
    return this.withTimeout(this.renderProjectToPdfInternal(project), RENDER_TIMEOUT_MS, project.id);
  }

  private async renderProjectToPdfInternal(project: Project): Promise<Buffer> {
    const ctx = this.mapper.toTemplateContext(project);

    // Cor de marca do cliente injetada como CSS custom property — os
    // templates já leem var(--color-accent) em todo o design system (Etapa 1/5).
    const accentColor = project.client.brandColors?.primary ?? '#c1503d';

    let body = '';
    body += this.coverTemplate({ client: ctx.client, project: ctx.project });
    body += this.gridTemplate({ client: ctx.client, project: ctx.project, posts: ctx.posts });

    for (const post of ctx.posts) {
      const template = this.postTemplatesByFormat[post.format as PostFormat];
      if (!template) {
        throw new Error(`Formato de post desconhecido: "${post.format}" (post ${post.orderIndex})`);
      }
      body += template({ client: ctx.client, project: ctx.project, post });
    }

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <style>${this.fontsCss}</style>
  <style>${this.designSystemCss}</style>
</head>
<body style="--color-accent: ${accentColor};">
  ${body}
</body>
</html>`;

    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      // Timeout de navegação/ação da própria página, além do timeout duro
      // do render inteiro — dá um erro mais específico ("Navigation
      // timeout") em vez do erro genérico do Promise.race.
      page.setDefaultTimeout(RENDER_TIMEOUT_MS - 5000);

      await page.setContent(html, { waitUntil: 'load' });

      // setContent não aceita mais 'networkidle0' nesta versão do Puppeteer —
      // esperamos explicitamente as fontes e as imagens remotas (Etapa 5:
      // as URLs de mídia são absolutas, do bucket, não paths locais).
      await page.evaluateHandle('document.fonts.ready');
      await page.evaluate(async () => {
        const images = Array.from(document.images);
        await Promise.all(
          images.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => {}))),
        );
      });

      const pdfBytes = await page.pdf({
        width: '420mm',
        height: '297mm',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '0', bottom: '0', left: '0', right: '0' },
      });

      this.rendersSinceLaunch += 1;
      return Buffer.from(pdfBytes);
    } finally {
      // finally garante o close mesmo se setContent/page.pdf lançar — a
      // `page` nunca fica pendurada, só o processo do Chromium (que é
      // deliberadamente reutilizado) continua vivo entre jobs.
      await page.close().catch((err) => this.logger.warn(`Erro ao fechar page: ${err.message}`));
    }
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number, projectId: string): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error(`Render do projeto ${projectId} excedeu ${ms}ms — abortado.`)),
        ms,
      );
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timeoutHandle!);
    }
  }
}
