import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

const mockPage = {
  setDefaultTimeout: jest.fn(),
  setContent: jest.fn().mockResolvedValue(undefined),
  evaluateHandle: jest.fn().mockResolvedValue(undefined),
  evaluate: jest.fn().mockResolvedValue(undefined),
  pdf: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  close: jest.fn().mockResolvedValue(undefined),
};
const mockBrowser = {
  connected: true,
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn().mockResolvedValue(undefined),
};
const mockLaunch = jest.fn().mockResolvedValue(mockBrowser);

jest.mock('puppeteer', () => ({ __esModule: true, default: { launch: mockLaunch } }));

import { PdfRenderService } from './pdf-render.service';
import { PdfDataMapper } from './pdf-data.mapper';
import { PostFormat } from '../../common/enums/post-format.enum';

function buildFakeProject() {
  return {
    id: 'proj-1',
    referenceMonth: '2026-07-01',
    coverImageUrl: null,
    client: { name: 'Casa Pla', slug: 'casapla', instagramHandle: 'vo.lu.ta', websiteLabel: 'voluta.company', brandColors: { primary: '#c1503d' } },
    posts: [
      {
        id: 'p1', orderIndex: 1, format: PostFormat.ESTATICO, publishDate: null, weekday: null,
        caption: 'Legenda', editorialLine: 'X', emotion: 'Y', funnelStage: null, media: [],
      },
    ],
  } as any;
}

describe('PdfRenderService', () => {
  let service: PdfRenderService;

  beforeEach(async () => {
    mockLaunch.mockClear();
    mockPage.pdf.mockClear();

    const module = await Test.createTestingModule({
      providers: [
        PdfRenderService,
        PdfDataMapper,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
      ],
    }).compile();

    service = module.get(PdfRenderService);
    service.onModuleInit(); // compila templates + registra ícones — feito 1x no boot real
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('compila sem lançar erro (todos os .hbs e o fonts.generated.css existem e são válidos)', () => {
    expect(() => service.onModuleInit()).not.toThrow();
  });

  it('renderiza um PDF (Buffer) a partir de um Project válido', async () => {
    const result = await service.renderProjectToPdf(buildFakeProject());
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(mockPage.pdf).toHaveBeenCalledWith(
      expect.objectContaining({ width: '420mm', height: '297mm', printBackground: true }),
    );
  });

  it('injeta a cor de marca do cliente como --color-accent no body', async () => {
    await service.renderProjectToPdf(buildFakeProject());
    const html = mockPage.setContent.mock.calls[0][0];
    expect(html).toContain('--color-accent: #c1503d');
  });

  it('usa #c1503d como fallback quando o cliente não tem brand_colors.primary configurado', async () => {
    const project = buildFakeProject();
    project.client.brandColors = {};
    await service.renderProjectToPdf(project);
    const html = mockPage.setContent.mock.calls[0][0];
    expect(html).toContain('--color-accent: #c1503d');
  });

  it('reutiliza a MESMA instância de browser entre renders (pool de 1, não sobe Chromium novo a cada job)', async () => {
    await service.renderProjectToPdf(buildFakeProject());
    await service.renderProjectToPdf(buildFakeProject());
    expect(mockLaunch).toHaveBeenCalledTimes(1);
  });

  it('lança erro com o número do post quando o formato é desconhecido', async () => {
    const project = buildFakeProject();
    project.posts[0].format = 'formato-invalido';
    await expect(service.renderProjectToPdf(project)).rejects.toThrow(/formato-invalido/);
  });

  it('recicla o browser após MAX_RENDERS_BEFORE_RECYCLE renders (evita memory creep de processo de vida longa)', async () => {
    // 50 é o valor de MAX_RENDERS_BEFORE_RECYCLE no serviço — roda 51
    // renders e confirma que o Chromium foi relançado pelo menos uma vez.
    for (let i = 0; i < 51; i++) {
      await service.renderProjectToPdf(buildFakeProject());
    }
    expect(mockLaunch.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('aborta o render se ele exceder o timeout duro (job travado não pode segurar RAM pra sempre)', async () => {
    jest.useFakeTimers();
    try {
      mockPage.pdf.mockImplementationOnce(() => new Promise(() => {})); // nunca resolve

      const pending = service.renderProjectToPdf(buildFakeProject());
      const assertion = expect(pending).rejects.toThrow(/excedeu/);
      await jest.advanceTimersByTimeAsync(46_000);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });
});
