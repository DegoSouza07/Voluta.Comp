import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './entities/client.entity';
import { Project } from '../projects/entities/project.entity';
import { Post } from '../posts/entities/post.entity';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Module({
  // Project e Post são registrados aqui só porque o TenantGuard (usado via
  // @UseGuards(TenantGuard) no controller) precisa deles no construtor —
  // o Nest resolve guards referenciados por classe DENTRO do módulo do
  // controller, não segue export de outro módulo pra isso.
  imports: [TypeOrmModule.forFeature([Client, Project, Post])],
  controllers: [ClientsController],
  providers: [ClientsService, TenantGuard],
  exports: [ClientsService, TypeOrmModule], // exporta o repo pra outros módulos (ex: AiModule lê tone_of_voice)
})
export class ClientsModule {}
