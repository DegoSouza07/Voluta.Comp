/**
 * Fábrica de mock de Repository<T> do TypeORM pros testes unitários.
 * Cada método vira um jest.fn() — o teste configura o retorno específico
 * com `.mockResolvedValue(...)` conforme o cenário.
 */
export type MockRepository<T = any> = Record<string, jest.Mock>;

export function createMockRepository<T = any>(): MockRepository<T> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}
