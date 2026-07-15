import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { Project } from '../projects/entities/project.entity';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Module({
  // Project é registrado aqui só pro construtor do TenantGuard — ver nota
  // em clients.module.ts sobre resolução de guards referenciados por classe.
  imports: [TypeOrmModule.forFeature([Post, Project])],
  controllers: [PostsController],
  providers: [PostsService, TenantGuard],
  exports: [PostsService, TypeOrmModule],
})
export class PostsModule {}
