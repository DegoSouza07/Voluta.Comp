// icons.ts
// Ícones SVG inline, estilo outline (stroke=currentColor), registrados como
// partials do Handlebars no worker de render. Substituem os glyphs Unicode
// (▦ ▷ ♡ etc.) usados na primeira validação de layout — Unicode depende da
// fonte disponível no Chromium do servidor e renderiza de forma inconsistente
// entre ambientes (ex: container Linux sem fonte de emoji instalada mostra
// um quadrado vazio no lugar do glyph).
//
// Todos com viewBox 24x24, sem fill fixo — herdam a cor via `color` do CSS.

export const icons: Record<string, string> = {
  'icon-grid': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="9.5" y="3" width="6" height="6" rx="1"/><rect x="16" y="3" width="5" height="6" rx="1"/><rect x="3" y="9.5" width="6" height="6" rx="1"/><rect x="9.5" y="9.5" width="6" height="6" rx="1"/><rect x="16" y="9.5" width="5" height="6" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="9.5" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="5" height="5" rx="1"/></svg>`,

  'icon-reels': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="5" width="19" height="15" rx="3"/><path d="M2.5 9.5h19M7 5l2.5 4.5M13 5l2.5 4.5" /><path d="M10.5 12.8l4 2.3-4 2.3v-4.6z" fill="currentColor" stroke="none"/></svg>`,

  'icon-tagged': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="10.5" r="3"/><path d="M6.5 17.5c1.2-2.3 3.2-3.5 5.5-3.5s4.3 1.2 5.5 3.5"/></svg>`,

  'icon-home': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 11.5L12 4l8 7.5"/><path d="M6 10v9.5a1 1 0 001 1h10a1 1 0 001-1V10"/><path d="M10 20.5v-6h4v6"/></svg>`,

  'icon-search': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/></svg>`,

  'icon-shop': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 8h14l-1 12.5a1.2 1.2 0 01-1.2 1H7.2a1.2 1.2 0 01-1.2-1L5 8z"/><path d="M8.5 8V6.5a3.5 3.5 0 017 0V8"/></svg>`,

  'icon-heart': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 20.5s-7.8-4.9-9.9-9.6C.6 7.3 2.4 4 5.9 4c2.1 0 3.6 1.2 4.6 2.6a1.7 1.7 0 001 0C12.5 5.2 14 4 16.1 4c3.5 0 5.3 3.3 3.8 6.9-2.1 4.7-9.9 9.6-9.9 9.6z"/></svg>`,

  'icon-comment': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 12a8 8 0 1114 5.3l1 3.2-3.5-1.1A8 8 0 013 12z"/></svg>`,

  'icon-share': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M21 3L10.5 13.5M21 3l-6.5 18-4-8-8-4L21 3z"/></svg>`,

  'icon-save': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M6 3.5h12a.5.5 0 01.5.5v17l-6.5-4-6.5 4v-17a.5.5 0 01.5-.5z"/></svg>`,

  'icon-play': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
};
