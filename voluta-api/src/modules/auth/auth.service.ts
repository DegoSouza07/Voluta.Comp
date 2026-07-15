import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);

    // Mesma mensagem de erro pra email inexistente e senha errada —
    // não vazamos qual dos dois estava incorreto (evita enumeração de contas).
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Email ou senha inválidos.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Email ou senha inválidos.');
    }

    const accessToken = await this.jwtService.signAsync({ sub: user.id });
    return { accessToken };
  }
}
