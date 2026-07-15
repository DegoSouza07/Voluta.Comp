// Stub de puppeteer pros testes e2e — o pacote real é ESM-only e quebra o
// parser do Jest quando a AppModule inteira é carregada (PdfRenderModule
// importa puppeteer no topo do arquivo). Os testes e2e não exercitam
// geração de PDF de verdade (isso já está coberto nos unitários de
// pdf-render.service.spec.ts com mock dedicado), então um stub básico
// que nunca é chamado é suficiente aqui.
module.exports = {
  launch: () => {
    throw new Error('Puppeteer real não deve ser chamado nos testes e2e — use os unitários de pdf-render.');
  },
};
