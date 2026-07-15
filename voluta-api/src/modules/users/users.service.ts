import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly usersRepository: Repository<User>) {}

  // select: false no passwordHash da entidade — precisa pedir explicitamente
  // via addSelect, senão o hash nunca vaza em nenhum outro find() da app.
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`Usuário ${id} não encontrado.`);
    return user;
  }

  create(data: Partial<User>): Promise<User> {
    return this.usersRepository.save(this.usersRepository.create(data));
  }
}
