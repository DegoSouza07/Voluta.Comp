import { Body, Controller, Get, INestApplication, Post, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

// Testa a configuração GLOBAL exposta em main.ts (prefixo /api, versionamento
// /v1, ValidationPipe com whitelist+forbidNonWhitelisted, e o formato único
// de erro do HttpExceptionFilter) — sem depender de Postgres real, que não
// está disponível neste ambiente de CI/sandbox. A lógica de negócio de cada
// módulo já está coberta pelos *.spec.ts unitários.

class DummyLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

@Controller('dummy')
class DummyController {
  @Get('ok')
  ok() {
    return { ok: true };
  }

  @Get('boom')
  boom() {
    throw new Error('erro interno não deveria vazar detalhe');
  }

  @Post('login')
  login(@Body() dto: DummyLoginDto) {
    return { received: dto };
  }
}

describe('Pipeline HTTP global (main.ts)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DummyController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde no path com prefixo /api/v1 (setGlobalPrefix + enableVersioning)', async () => {
    await request(app.getHttpServer()).get('/api/v1/dummy/ok').expect(200, { ok: true });
  });

  it('retorna 404 pro path sem o prefixo /api/v1', async () => {
    await request(app.getHttpServer()).get('/dummy/ok').expect(404);
  });

  it('rejeita payload com campo não declarado no DTO (forbidNonWhitelisted)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/dummy/login')
      .send({ email: 'a@b.com', password: 'senha1234', campoNaoPermitido: 'x' });

    expect(res.status).toBe(400);
  });

  it('rejeita payload que falha a validação (senha curta demais)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/dummy/login')
      .send({ email: 'a@b.com', password: '123' });

    expect(res.status).toBe(400);
  });

  it('aceita payload válido e devolve o corpo transformado pelo DTO', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/dummy/login')
      .send({ email: 'a@b.com', password: 'senha1234' });

    expect(res.status).toBe(201);
    expect(res.body.received).toEqual({ email: 'a@b.com', password: 'senha1234' });
  });

  it('erro não tratado vira 500 com mensagem genérica (HttpExceptionFilter nunca vaza stack trace)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/dummy/boom');

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('erro interno não deveria vazar detalhe');
    expect(res.body.path).toBe('/api/v1/dummy/boom');
  });
});
