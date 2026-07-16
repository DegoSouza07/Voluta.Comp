import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { UserRole } from '../src/common/enums/user-role.enum';

/**
 * E2E de verdade: sobe a AppModule inteira contra um Postgres e Redis
 * REAIS (não mockados), aplica as migrations de sql/, faz login de
 * verdade via bcrypt+JWT, e prova por HTTP que um client_viewer de um
 * cliente NÃO enxerga dado de outro cliente — a garantia central do
 * TenantGuard. Isso é o "e2e com banco real" que ficou como pendência.
 *
 * Requer DB_NAME apontando pra um banco já com as migrations 000 e 001
 * aplicadas (ver README — "Como rodar os testes e2e com banco real").
 */
describe('Isolamento de tenant (e2e, banco real)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let adminToken: string;
  let clientAId: string;
  let clientBId: string;
  let projectAId: string;
  let projectBId: string;
  let viewerAToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    dataSource = app.get(DataSource);

    // login com o admin seedado em sql/000_init.sql
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'diego@voluta.company', password: 'trocar123' });
    adminToken = loginRes.body.accessToken;
  }, 30000);

  afterAll(async () => {
    if (!dataSource) return;
    // limpa só o que este teste criou — nunca faz DROP/TRUNCATE do banco inteiro
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'viewer-%@e2e-test.example.com'`);
    await dataSource.query(`DELETE FROM projects WHERE title LIKE 'E2E %'`);
    await dataSource.query(`DELETE FROM clients WHERE slug LIKE 'e2e-%'`);
    await app.close();
  });

  it('login do admin seedado funciona (bcrypt real + JWT real)', () => {
    expect(adminToken).toBeTruthy();
  });

  it('admin cria dois clientes distintos (Cliente A e Cliente B)', async () => {
    const resA = await request(app.getHttpServer())
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Cliente A', slug: 'e2e-cliente-a' });
    expect(resA.status).toBe(201);
    clientAId = resA.body.id;

    const resB = await request(app.getHttpServer())
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Cliente B', slug: 'e2e-cliente-b' });
    expect(resB.status).toBe(201);
    clientBId = resB.body.id;
  });

  it('admin cria um projeto pra cada cliente', async () => {
    const resA = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId: clientAId, title: 'E2E Projeto A', referenceMonth: '2026-07-01' });
    expect(resA.status).toBe(201);
    projectAId = resA.body.id;

    const resB = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId: clientBId, title: 'E2E Projeto B', referenceMonth: '2026-07-01' });
    expect(resB.status).toBe(201);
    projectBId = resB.body.id;
  });

  it('cria um usuário client_viewer vinculado ao Cliente A e faz login', async () => {
    const passwordHash = await bcrypt.hash('senha-do-cliente', 4);
    await dataSource.query(
      `INSERT INTO users (email, name, role, password_hash, client_id) VALUES ($1, $2, $3, $4, $5)`,
      ['viewer-a@e2e-test.example.com', 'Viewer Cliente A', UserRole.CLIENT_VIEWER, passwordHash, clientAId],
    );

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'viewer-a@e2e-test.example.com', password: 'senha-do-cliente' });

    expect(loginRes.status).toBe(200);
    viewerAToken = loginRes.body.accessToken;
  });

  it('client_viewer do Cliente A ENXERGA o próprio cliente', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/clients/${clientAId}`)
      .set('Authorization', `Bearer ${viewerAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(clientAId);
  });

  it('client_viewer do Cliente A NÃO ENXERGA o Cliente B (403, não 404 — TenantGuard bloqueia antes do service)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/clients/${clientBId}`)
      .set('Authorization', `Bearer ${viewerAToken}`);
    expect(res.status).toBe(403);
  });

  it('client_viewer do Cliente A ENXERGA o projeto do próprio cliente', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectAId}`)
      .set('Authorization', `Bearer ${viewerAToken}`);
    expect(res.status).toBe(200);
  });

  it('client_viewer do Cliente A NÃO ENXERGA o projeto do Cliente B, mesmo sabendo o UUID exato', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectBId}`)
      .set('Authorization', `Bearer ${viewerAToken}`);
    expect(res.status).toBe(403);
  });

  it('client_viewer NÃO CONSEGUE criar projeto (mutação é só pra equipe Voluta)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${viewerAToken}`)
      .send({ clientId: clientAId, title: 'Tentativa indevida', referenceMonth: '2026-08-01' });
    expect(res.status).toBe(403);
  });

  it('admin (voluta_admin) continua enxergando os dois clientes normalmente — restrição é só pro client_viewer', async () => {
    const resA = await request(app.getHttpServer())
      .get(`/api/v1/clients/${clientAId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const resB = await request(app.getHttpServer())
      .get(`/api/v1/clients/${clientBId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
  });

  it('sem token nenhum, tudo retorna 401 antes mesmo do TenantGuard rodar', async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/clients/${clientAId}`);
    expect(res.status).toBe(401);
  });
});
