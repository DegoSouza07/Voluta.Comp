import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantResource } from '../../common/decorators/tenant-resource.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { TenantResourceType } from '../../common/enums/tenant-resource-type.enum';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @Roles(UserRole.VOLUTA_ADMIN)
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  // Lista completa de clientes — só faz sentido pra equipe Voluta. Um
  // client_viewer não tem por que ver quais outras marcas a agência atende.
  @Get()
  @Roles(UserRole.VOLUTA_ADMIN, UserRole.VOLUTA_EDITOR)
  findAll() {
    return this.clientsService.findAll();
  }

  @Get(':id')
  @TenantResource(TenantResourceType.CLIENT, 'id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.VOLUTA_ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.VOLUTA_ADMIN)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.deactivate(id);
  }
}
