import { resolveCorsOrigin } from './cors-origin.util';

describe('resolveCorsOrigin', () => {
  it('retorna "*" (string) quando o valor é "*" — regressão do bug real: NÃO pode virar ["*"]', () => {
    expect(resolveCorsOrigin('*')).toBe('*');
  });

  it('retorna "*" quando a variável não está definida (fallback permissivo em dev)', () => {
    expect(resolveCorsOrigin(undefined)).toBe('*');
  });

  it('retorna um array quando há uma origem específica', () => {
    expect(resolveCorsOrigin('https://voluta.app')).toEqual(['https://voluta.app']);
  });

  it('separa múltiplas origens por vírgula e remove espaços', () => {
    expect(resolveCorsOrigin('https://voluta.app, https://staging.voluta.app')).toEqual([
      'https://voluta.app',
      'https://staging.voluta.app',
    ]);
  });
});