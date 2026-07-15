import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Abstração sobre o Object Storage (S3-compatible — Supabase Storage,
 * Cloudflare R2 ou AWS S3, todos falam o mesmo protocolo). Nenhum outro
 * módulo importa @aws-sdk diretamente — só este serviço.
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.getOrThrow<string>('STORAGE_BUCKET');
    this.client = new S3Client({
      region: this.config.get<string>('STORAGE_REGION', 'auto'),
      endpoint: this.config.getOrThrow<string>('STORAGE_ENDPOINT'),
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('STORAGE_ACCESS_KEY'),
        secretAccessKey: this.config.getOrThrow<string>('STORAGE_SECRET_KEY'),
      },
    });
  }

  async createUploadUrl(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    // 10 min é suficiente pro upload de um arquivo de ensaio (mesmo em rede
    // ruim) sem deixar a URL utilizável por muito tempo depois.
    return getSignedUrl(this.client, command, { expiresIn: 600 });
  }

  async uploadBuffer(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return this.publicUrlFor(key);
  }

  async downloadBuffer(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  publicUrlFor(key: string): string {
    return `${this.config.getOrThrow<string>('STORAGE_PUBLIC_BASE_URL')}/${key}`;
  }

  keyFromPublicUrl(url: string): string {
    const base = this.config.getOrThrow<string>('STORAGE_PUBLIC_BASE_URL');
    return url.replace(`${base}/`, '');
  }
}
