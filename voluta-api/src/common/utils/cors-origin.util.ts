/**
 * Resolve o valor de CORS_ORIGIN pro formato que `app.enableCors()`
 * espera.
 *
 * Cuidado: `'*'.split(',')` vira `['*']` — um ARRAY contendo a string
 * "*", não a string "*" sozinha. O pacote `cors` trata array como
 * whitelist estrita (só libera Origin que bater exatamente com um item
 * da lista), e nenhum navegador manda `Origin: *` de verdade. Por isso
 * "*" precisa ser tratado como caso especial ANTES do split — bug real
 * que já aconteceu aqui (CORS_ORIGIN=* bloqueava toda origem, o oposto
 * do que devia fazer).
 */
export function resolveCorsOrigin(raw: string | undefined): string | string[] {
  if (!raw || raw === '*') return '*';
  return raw.split(',').map((origin) => origin.trim());
}