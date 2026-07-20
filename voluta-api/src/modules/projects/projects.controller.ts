import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantResource } from '../../common/decorators/tenant-resource.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { UserRole } from '../../common/enums/user-role.enum';
import { TenantResourceType } from '../../common/enums/tenant-resource-type.enum';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Roles(UserRole.VOLUTA_ADMIN, UserRole.VOLUTA_EDITOR)
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.create(dto, user);
  }

  @Get('by-client/:clientId')
  @TenantResource(TenantResourceType.CLIENT, 'clientId')
  findByClient(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return this.projectsService.findByClient(clientId);
  }

  @Get(':id')
  @TenantResource(TenantResourceType.PROJECT, 'id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.VOLUTA_ADMIN, UserRole.VOLUTA_EDITOR)
  @TenantResource(TenantResourceType.PROJECT, 'id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  // Dispara a publicação (gera slug público). A geração do PDF em si é
  // assíncrona — ver PdfRenderModule (Etapa 5), chamado via fila a partir
  // de um endpoint separado (POST /projects/:id/render-pdf).
  @Patch(':id/publish')
  @Roles(UserRole.VOLUTA_ADMIN, UserRole.VOLUTA_EDITOR)
  @TenantResource(TenantResourceType.PROJECT, 'id')
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.publish(id);
  }

  @Delete(':id')
  @Roles(UserRole.VOLUTA_ADMIN, UserRole.VOLUTA_EDITOR)
  @TenantResource(TenantResourceType.PROJECT, 'id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.remove(id);
  }
}
