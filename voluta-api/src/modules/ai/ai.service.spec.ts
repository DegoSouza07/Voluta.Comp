import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';

const mockCreate = jest.fn();

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: { completions: { parse: mockCreate } },
    })),
  };
});

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    mockCreate.mockReset();
    const module = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: ConfigService, useValue: { getOrThrow: () => 'fake-api-key' } },
      ],
    }).compile();
    service = module.get(AiService);
  });

  it('retorna o objeto parsed quando a IA responde corretamente', async () => {
    const parsed = {
      caption: 'Legenda', editorialLine: 'X', funnelStage: 'descoberta',
      emotion: 'Y', tags: ['a'], visualHooks: ['b'],
    };
    mockCreate.mockResolvedValue({ choices: [{ message: { parsed } }] });

    const result = await service.analyzePost({
      imageUrl: 'https://cdn.test/x.jpg', userContext: 'ctx', toneOfVoice: 'caloroso', brandName: 'Casa Pla',
    });

    expect(result).toEqual(parsed);
  });

  it('lança erro explícito se a IA não retornar um objeto estruturado válido (nunca retorna undefined silenciosamente)', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { parsed: null } }] });

    await expect(
      service.analyzePost({ imageUrl: 'x', userContext: 'y', toneOfVoice: 'z', brandName: 'w' }),
    ).rejects.toThrow(/não retornou um objeto estruturado válido/);
  });

  it('envia a imagem com detail=high (fidelidade de composição importa mais que custo aqui)', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { parsed: { caption: 'x', editorialLine: 'y', funnelStage: 'descoberta', emotion: 'z', tags: [], visualHooks: [] } } }],
    });

    await service.analyzePost({ imageUrl: 'https://cdn.test/preview.jpg', userContext: '', toneOfVoice: '', brandName: '' });

    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages.find((m: any) => m.role === 'user');
    const imageBlock = userMessage.content.find((c: any) => c.type === 'image_url');
    expect(imageBlock.image_url.detail).toBe('high');
    expect(imageBlock.image_url.url).toBe('https://cdn.test/preview.jpg');
  });
});
