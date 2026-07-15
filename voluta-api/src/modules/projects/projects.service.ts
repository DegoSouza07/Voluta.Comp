import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { nanoid } from 'nanoid';
import { Project } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectStatus } from '../../common/enums/project-status.enum';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projectsRepository: Repository<Project>,
  ) {}

  create(dto: CreateProjectDto, creator: AuthenticatedUser): Promise<Project> {
    return this.projectsRepository.save(
      this.projectsRepository.create({ ...dto, createdBy: creator.id }),
    );
  }

  findByClient(clientId: string): Promise<Project[]> {
    return this.projectsRepository.find({
      where: { clientId },
      order: { referenceMonth: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { id },
      relations: { client: true },
    });
    if (!project) throw new NotFoundException(`Projeto ${id} não encontrado.`);
    return project;
  }

  // Usado pela rota pública do portal de aprovação (Etapa 6) — nunca expõe
  // o UUID interno, só o slug não-sequencial.
  async findByPublicSlug(slug: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { publicSlug: slug },
      relations: { client: true, posts: true },
    });
    if (!project) throw new NotFoundException('Plano visual não encontrado ou link expirado.');
    return project;
  }

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id);
    Object.assign(project, dto);
    return this.projectsRepository.save(project);
  }

  // Gera o slug só no momento da publicação — projetos em rascunho nunca
  // têm link público ativo (ver Etapa 6).
  async publish(id: string): Promise<Project> {
    const project = await this.findOne(id);
    if (!project.publicSlug) {
      project.publicSlug = nanoid(16);
    }
    project.status = ProjectStatus.PUBLISHED;
    return this.projectsRepository.save(project);
  }

  async attachRenderedPdf(id: string, pdfUrl: string): Promise<Project> {
    const project = await this.findOne(id);
    project.pdfUrl = pdfUrl;
    project.pdfGeneratedAt = new Date();
    return this.projectsRepository.save(project);
  }
}
