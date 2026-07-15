import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { Post } from '../posts/entities/post.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Module({
  // Post é registrado aqui só pro construtor do TenantGuard — ver nota em
  // clients.module.ts sobre resolução de guards referenciados por classe.
  imports: [TypeOrmModule.forFeature([Project, Post])],
  controllers: [ProjectsController],
  providers: [ProjectsService, TenantGuard],
  exports: [ProjectsService, TypeOrmModule],
})
export class ProjectsModule {}
