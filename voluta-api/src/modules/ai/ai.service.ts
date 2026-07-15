import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { PostAnalysisSchema, PostAnalysis } from './schemas/post-analysis.schema';

interface AnalyzePostParams {
  imageUrl: string; // sempre a variante `preview` (1200px) — nunca o original
  userContext: string;
  toneOfVoice: string;
  brandName: string;
}

@Injectable()
export class AiService {
  private readonly client: OpenAI;

  constructor(config: ConfigService) {
    this.client = new OpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') });
  }

  async analyzePost(params: AnalyzePostParams): Promise<PostAnalysis> {
    const { imageUrl, userContext, toneOfVoice, brandName } = params;

    const completion = await this.client.chat.completions.parse({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Você é um estrategista de conteúdo para redes sociais especializado na marca "${brandName}". Tom de voz obrigatório: ${toneOfVoice}. Analise a imagem enviada e o contexto fornecido pelo produtor de conteúdo, e retorne uma proposta editorial completa para este post.`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Contexto fornecido pela equipe: "${userContext}"` },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          ],
        },
      ],
      response_format: zodResponseFormat(PostAnalysisSchema, 'post_analysis'),
      temperature: 0.7,
    });

    const parsed = completion.choices[0].message.parsed;
    if (!parsed) {
      throw new Error('IA não retornou um objeto estruturado válido — resposta rejeitada pelo schema.');
    }
    return parsed;
  }
}
