import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantGuard } from './tenant.guard';
import { TenantResourceType } from '../enums/tenant-resource-type.enum';
import { UserRole } from '../enums/user-role.enum';

function buildContext(user: any, params: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, params }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('TenantGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let projectsRepo: { findOne: jest.Mock };
  let postsRepo: { findOne: jest.Mock };
  let guard: TenantGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    projectsRepo = { findOne: jest.fn() };
    postsRepo = { findOne: jest.fn() };
    guard = new TenantGuard(reflector as unknown as Reflector, projectsRepo as any, postsRepo as any);
  });

  it('deixa passar quando a rota não está marcada com @TenantResource', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = buildContext({ role: UserRole.CLIENT_VIEWER, clientId: 'c1' }, { id: 'outro-cliente' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('deixa passar equipe Voluta (voluta_admin) mesmo em rota marcada — instância de agência única', async () => {
    reflector.getAllAndOverride.mockReturnValue({ type: TenantResourceType.CLIENT, param: 'id' });
    const ctx = buildContext({ role: UserRole.VOLUTA_ADMIN, clientId: null }, { id: 'qualquer-cliente' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('deixa passar equipe Voluta (voluta_editor) também', async () => {
    reflector.getAllAndOverride.mockReturnValue({ type: TenantResourceType.PROJECT, param: 'id' });
    const ctx = buildContext({ role: UserRole.VOLUTA_EDITOR, clientId: null }, { id: 'qualquer-projeto' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  describe('client_viewer — recurso tipo CLIENT', () => {
    it('deixa passar quando o :id da rota é o PRÓPRIO client_id do usuário', async () => {
      reflector.getAllAndOverride.mockReturnValue({ type: TenantResourceType.CLIENT, param: 'id' });
      const ctx = buildContext({ role: UserRole.CLIENT_VIEWER, clientId: 'c1' }, { id: 'c1' });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('bloqueia quando o :id da rota é de OUTRO cliente', async () => {
      reflector.getAllAndOverride.mockReturnValue({ type: TenantResourceType.CLIENT, param: 'id' });
      const ctx = buildContext({ role: UserRole.CLIENT_VIEWER, clientId: 'c1' }, { id: 'c2-de-outra-marca' });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('client_viewer — recurso tipo PROJECT', () => {
    it('deixa passar quando o projeto pertence ao client_id do usuário', async () => {
      reflector.getAllAndOverride.mockReturnValue({ type: TenantResourceType.PROJECT, param: 'id' });
      projectsRepo.findOne.mockResolvedValue({ id: 'proj-1', clientId: 'c1' });
      const ctx = buildContext({ role: UserRole.CLIENT_VIEWER, clientId: 'c1' }, { id: 'proj-1' });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('bloqueia quando o projeto pertence a OUTRO cliente', async () => {
      reflector.getAllAndOverride.mockReturnValue({ type: TenantResourceType.PROJECT, param: 'id' });
      projectsRepo.findOne.mockResolvedValue({ id: 'proj-1', clientId: 'c2-de-outra-marca' });
      const ctx = buildContext({ role: UserRole.CLIENT_VIEWER, clientId: 'c1' }, { id: 'proj-1' });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('lança NotFoundException se o projeto não existe (não deixa passar por engano)', async () => {
      reflector.getAllAndOverride.mockReturnValue({ type: TenantResourceType.PROJECT, param: 'id' });
      projectsRepo.findOne.mockResolvedValue(null);
      const ctx = buildContext({ role: UserRole.CLIENT_VIEWER, clientId: 'c1' }, { id: 'projeto-inexistente' });
      await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
    });
  });

  describe('client_viewer — recurso tipo POST', () => {
    it('deixa passar quando o post pertence (via projeto) ao client_id do usuário', async () => {
      reflector.getAllAndOverride.mockReturnValue({ type: TenantResourceType.POST, param: 'id' });
      postsRepo.findOne.mockResolvedValue({ id: 'post-1', project: { clientId: 'c1' } });
      const ctx = buildContext({ role: UserRole.CLIENT_VIEWER, clientId: 'c1' }, { id: 'post-1' });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('bloqueia quando o post pertence a um projeto de OUTRO cliente', async () => {
      reflector.getAllAndOverride.mockReturnValue({ type: TenantResourceType.POST, param: 'id' });
      postsRepo.findOne.mockResolvedValue({ id: 'post-1', project: { clientId: 'c2-de-outra-marca' } });
      const ctx = buildContext({ role: UserRole.CLIENT_VIEWER, clientId: 'c1' }, { id: 'post-1' });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  it('a mensagem de erro é a mesma pra "existe mas é de outro cliente" — não confirma nem nega a existência do recurso pro client_viewer errado', async () => {
    reflector.getAllAndOverride.mockReturnValue({ type: TenantResourceType.CLIENT, param: 'id' });
    const ctx = buildContext({ role: UserRole.CLIENT_VIEWER, clientId: 'c1' }, { id: 'c2' });

    let message = '';
    try {
      await guard.canActivate(ctx);
    } catch (e) {
      message = (e as ForbiddenException).message;
    }
    expect(message).toBe('Você não tem permissão para acessar este recurso.');
  });
});
