import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WebhookNotifyProcessor } from './webhook-notify.processor';

describe('WebhookNotifyProcessor', () => {
  let processor: WebhookNotifyProcessor;
  let config: { get: jest.Mock };
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    config = { get: jest.fn() };
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;

    const module = await Test.createTestingModule({
      providers: [WebhookNotifyProcessor, { provide: ConfigService, useValue: config }],
    }).compile();

    processor = module.get(WebhookNotifyProcessor);
  });

  it('não chama fetch e não lança erro quando SLACK_WEBHOOK_URL não está configurado (descarta com log)', async () => {
    config.get.mockReturnValue(undefined);
    await expect(
      processor.process({ data: { eventType: 'post_approved', postId: 'p1', postOrderIndex: 1 } } as any),
    ).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envia mensagem de aprovação formatada com ✅ quando eventType=post_approved', async () => {
    config.get.mockReturnValue('https://hooks.slack.test/xyz');
    fetchMock.mockResolvedValue({ ok: true });

    await processor.process({
      data: { eventType: 'post_approved', postId: 'p1', postOrderIndex: 3, projectTitle: 'Julho 2026' },
    } as any);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('✅');
    expect(body.text).toContain('#3');
  });

  it('envia mensagem de ajuste formatada com 🔴 e o comentário quando eventType=change_requested', async () => {
    config.get.mockReturnValue('https://hooks.slack.test/xyz');
    fetchMock.mockResolvedValue({ ok: true });

    await processor.process({
      data: { eventType: 'change_requested', postId: 'p1', postOrderIndex: 5, projectTitle: 'Julho', comment: 'Trocar cor' },
    } as any);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('🔴');
    expect(body.text).toContain('Trocar cor');
  });

  it('lança erro quando o Slack responde com status != ok (permite o BullMQ re-tentar)', async () => {
    config.get.mockReturnValue('https://hooks.slack.test/xyz');
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await expect(
      processor.process({ data: { eventType: 'post_approved', postId: 'p1', postOrderIndex: 1 } } as any),
    ).rejects.toThrow(/Slack respondeu/);
  });
});
