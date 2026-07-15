import { z } from 'zod';

// Mesmo schema descrito na Etapa 3 — fonte única de verdade tanto pro
// Structured Output da OpenAI quanto pro type-safety no TypeScript.
export const PostAnalysisSchema = z.object({
  caption: z.string().describe('Legenda pronta para publicação, no tom de voz da marca'),
  editorialLine: z.string().describe('Categoria editorial, ex: Institucional, Bastidores, Prova Social'),
  funnelStage: z.enum(['descoberta', 'consideracao', 'decisao']),
  emotion: z.string().describe('Emoção principal que o post deve despertar'),
  tags: z.array(z.string()).max(8),
  visualHooks: z.array(z.string()).max(3),
});

export type PostAnalysis = z.infer<typeof PostAnalysisSchema>;
