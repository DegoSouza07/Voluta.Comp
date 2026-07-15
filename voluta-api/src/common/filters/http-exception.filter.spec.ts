import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function buildHost(url = '/api/v1/clients') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  it('usa o status code da HttpException quando é uma exceção conhecida do Nest', () => {
    const filter = new HttpExceptionFilter();
    const { host, status } = buildHost();

    filter.catch(new BadRequestException('campo inválido'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('usa 500 e mensagem genérica quando é um erro nativo (não vaza stack trace pro cliente)', () => {
    const filter = new HttpExceptionFilter();
    const { host, status, json } = buildHost();

    filter.catch(new Error('detalhe interno sensível do banco'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const payload = json.mock.calls[0][0];
    expect(payload.message).not.toContain('detalhe interno sensível do banco');
  });

  it('inclui path e timestamp no corpo do erro', () => {
    const filter = new HttpExceptionFilter();
    const { host, json } = buildHost('/api/v1/projects/123');

    filter.catch(new BadRequestException('x'), host);

    const payload = json.mock.calls[0][0];
    expect(payload.path).toBe('/api/v1/projects/123');
    expect(payload.timestamp).toBeDefined();
  });
});
