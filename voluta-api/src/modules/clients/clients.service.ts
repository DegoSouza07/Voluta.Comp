import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client) private readonly clientsRepository: Repository<Client>,
  ) {}

  async create(dto: CreateClientDto): Promise<Client> {
    const existing = await this.clientsRepository.findOne({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`Já existe um cliente com o slug "${dto.slug}".`);
    }
    return this.clientsRepository.save(this.clientsRepository.create(dto));
  }

  findAll(): Promise<Client[]> {
    return this.clientsRepository.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Client> {
    const client = await this.clientsRepository.findOne({ where: { id } });
    if (!client) throw new NotFoundException(`Cliente ${id} não encontrado.`);
    return client;
  }

  async update(id: string, dto: UpdateClientDto): Promise<Client> {
    const client = await this.findOne(id);
    Object.assign(client, dto);
    return this.clientsRepository.save(client);
  }

  // Soft delete — nunca apagamos um cliente de verdade (histórico de
  // projetos e faturamento depende dele).
  async deactivate(id: string): Promise<void> {
    const client = await this.findOne(id);
    client.isActive = false;
    await this.clientsRepository.save(client);
  }
}
