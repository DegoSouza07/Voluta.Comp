import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post as HttpPost, UseGuards } from '@nestjs/common';
import { PostsService } from './posts.service';
import { UpdatePostDto } from './dto/update-post.dto';
import { ReorderPostsDto } from './dto/reorder-posts.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantResource } from '../../common/decorators/tenant-resource.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { TenantResourceType } from '../../common/enums/tenant-resource-type.enum';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @HttpPost('projects/:projectId/posts')
  @Roles(UserRole.VOLUTA_ADMIN, UserRole.VOLUTA_EDITOR)
  @TenantResource(TenantResourceType.PROJECT, 'projectId')
  createDraft(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.postsService.createDraft(projectId, dto);
  }

  @Get('projects/:projectId/posts')
  @TenantResource(TenantResourceType.PROJECT, 'projectId')
  findByProject(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.postsService.findByProject(projectId);
  }

  @Patch('projects/:projectId/posts/reorder')
  @Roles(UserRole.VOLUTA_ADMIN, UserRole.VOLUTA_EDITOR)
  @TenantResource(TenantResourceType.PROJECT, 'projectId')
  reorder(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: ReorderPostsDto,
  ) {
    return this.postsService.reorder(projectId, dto);
  }

  @Patch('posts/:id')
  @Roles(UserRole.VOLUTA_ADMIN, UserRole.VOLUTA_EDITOR)
  @TenantResource(TenantResourceType.POST, 'id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePostDto) {
    return this.postsService.update(id, dto);
  }

  @Patch('posts/:id/ready-to-render')
  @Roles(UserRole.VOLUTA_ADMIN, UserRole.VOLUTA_EDITOR)
  @TenantResource(TenantResourceType.POST, 'id')
  markReadyToRender(@Param('id', ParseUUIDPipe) id: string) {
    return this.postsService.markReadyToRender(id);
  }
}
