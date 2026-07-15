import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../enums/user-role.enum';

function buildContext(user: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('deixa passar quando o handler não tem @Roles() (nenhuma restrição declarada)', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = buildContext({ role: UserRole.VOLUTA_EDITOR });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('deixa passar quando o papel do usuário está na lista exigida', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.VOLUTA_ADMIN]);
    const ctx = buildContext({ role: UserRole.VOLUTA_ADMIN });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('bloqueia quando o papel do usuário NÃO está na lista exigida', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.VOLUTA_ADMIN]);
    const ctx = buildContext({ role: UserRole.VOLUTA_EDITOR });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('bloqueia quando não há usuário na request mas a rota exige papel específico', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.VOLUTA_ADMIN]);
    const ctx = buildContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
