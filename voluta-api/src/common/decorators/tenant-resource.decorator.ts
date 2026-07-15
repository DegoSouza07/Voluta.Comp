import { SetMetadata } from '@nestjs/common';
import { TenantResourceType } from '../enums/tenant-resource-type.enum';

export const TENANT_RESOURCE_KEY = 'tenant_resource';

export interface TenantResourceMeta {
  type: TenantResourceType;
  param: string; // nome do @Param() na rota que carrega o id do recurso
}

/**
 * Marca um endpoint como pertencente a um recurso de cliente específico —
 * o TenantGuard usa isso pra checar se um usuário `client_viewer` tem
 * permissão de ver ESSE recurso, e não o de outro cliente.
 *
 * Uso: @TenantResource(TenantResourceType.PROJECT, 'id')
 */
export const TenantResource = (type: TenantResourceType, param: string) =>
  SetMetadata(TENANT_RESOURCE_KEY, { type, param } as TenantResourceMeta);
