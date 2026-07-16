import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // base relativo (não absoluto) — funciona em qualquer subpath sem
  // precisar saber o nome do repositório de antemão. Importante pro
  // GitHub Pages, que serve o site em /<nome-do-repo>/, não na raiz.
  base: './',
})
