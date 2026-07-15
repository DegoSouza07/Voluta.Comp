import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import databaseConfig from './config/typeorm.config';
import redisConfig from './config/bullmq.config';

/**
 * Infraestrutura compartilhada por API e Worker: config, conexão com
 * Postgres e conexão com Redis (BullMQ). Ambos os processos falam com o
 * MESMO banco e o MESMO Redis — a única coisa que muda entre eles é quais
 * módulos de domínio cada um carrega (controllers vs. processors).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [databaseConfig, redisConfig] }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get('database')!,
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get('redis')!,
    }),
  ],
  exports: [ConfigModule, TypeOrmModule, BullModule],
})
export class CoreModule {}
