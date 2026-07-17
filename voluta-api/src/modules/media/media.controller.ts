import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { MediaService } from './media.service';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantResource } from '../../common/decorators/tenant-resource.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { TenantResourceType } from '../../common/enums/tenant-resource-type.enum';

@Controller('posts/:postId/media')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Roles(UserRole.VOLUTA_ADMIN, UserRole.VOLUTA_EDITOR) // upload é sempre trabalho da equipe Voluta
@TenantResource(TenantResourceType.POST, 'postId')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload-url')
  createUploadUrl(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: CreateUploadUrlDto,
  ) {
    return this.mediaService.createUploadUrl(postId, dto);
  }

  @Post(':postMediaId/confirm-upload')
  confirmUpload(@Param('postMediaId', ParseUUIDPipe) postMediaId: string) {
    return this.mediaService.confirmUpload(postMediaId);
  }

  @Get()
  findByPost(@Param('postId', ParseUUIDPipe) postId: string) {
    return this.mediaService.findByPost(postId);
  }

  @Delete(':postMediaId')
  deleteMedia(@Param('postMediaId', ParseUUIDPipe) postMediaId: string) {
    return this.mediaService.deleteMedia(postMediaId);
  }
}