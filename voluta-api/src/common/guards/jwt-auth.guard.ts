import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard padrão para toda rota autenticada da equipe Voluta.
 * Rotas públicas (portal de aprovação do cliente) NUNCA usam este guard —
 * elas são protegidas por slug não-sequencial (ver ApprovalModule), não por JWT.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
