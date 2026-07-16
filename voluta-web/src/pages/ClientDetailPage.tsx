import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Breadcrumb, PageHeader } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Badge, Button, Card, ErrorBanner, Field, TextInput } from '../components/ui';
import { ApiError, clientsApi, projectsApi, type Client, type Project, type ProjectStatus } from '../lib/api';
import s from './shared.module.css';

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: 'Planejamento',
  in_review: 'Em revisão',
  approved: 'Aprovado',
  published: 'Publicado',
  archived: 'Arquivado',
};

const STATUS_TONE: Record<ProjectStatus, 'neutral' | 'accent' | 'success'> = {
  planning: 'neutral',
  in_review: 'accent',
  approved: 'accent',
  published: 'success',
  archived: 'neutral',
};

function monthLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00Z`);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');

  function reload() {
    if (!clientId) return;
    clientsApi.get(clientId).then(setClient).catch((err) => setError(errMsg(err)));
    projectsApi
      .listByClient(clientId)
      .then(setProjects)
      .catch((err) => setError(errMsg(err)));
  }

  useEffect(reload, [clientId]);

  if (!clientId) return null;

  return (
    <div>
      <Breadcrumb>
        <Link to="/clients">Clientes</Link> <span>/</span> <span>{client?.name ?? '...'}</span>
      </Breadcrumb>

      <PageHeader
        title={client?.name ?? 'Carregando...'}
        subtitle={client ? `@${client.instagramHandle ?? client.slug}` : undefined}
        action={<Button onClick={() => setShowCreate(true)}>+ Novo plano visual</Button>}
      />

      <ErrorBanner>{error}</ErrorBanner>

      {projects?.length === 0 && (
        <div className={s.emptyState}>
          <h3>Nenhum plano visual ainda</h3>
          <p>Crie o primeiro plano do mês pra esse cliente.</p>
          <Button onClick={() => setShowCreate(true)}>+ Novo plano visual</Button>
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className={s.grid}>
          {projects.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Card hover>
                <div className={s.itemTitle}>{project.title}</div>
                <div className={s.itemMeta} style={{ textTransform: 'capitalize' }}>
                  {monthLabel(project.referenceMonth)}
                </div>
                <div className={s.itemFooter}>
                  <Badge tone={STATUS_TONE[project.status]}>{STATUS_LABEL[project.status]}</Badge>
                  {project.pdfUrl && <Badge tone="success">PDF pronto</Badge>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {showCreate && clientId && (
        <CreateProjectModal clientId={clientId} onClose={() => setShowCreate(false)} onCreated={reload} />
      )}
    </div>
  );
}

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Algo deu errado.';
}

function CreateProjectModal({
  clientId,
  onClose,
  onCreated,
}: {
  clientId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

  const [title, setTitle] = useState('');
  const [referenceMonth, setReferenceMonth] = useState(defaultMonth);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await projectsApi.create({ clientId, title, referenceMonth });
      onCreated();
      onClose();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Novo plano visual" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <ErrorBanner>{error}</ErrorBanner>

        <Field label="Título">
          <TextInput
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Casa Pla - Agosto 2026"
          />
        </Field>

        <Field label="Mês de referência">
          <TextInput
            type="date"
            required
            value={referenceMonth}
            onChange={(e) => setReferenceMonth(e.target.value)}
          />
        </Field>

        <div className={s.modalActions}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting || !title}>
            {submitting ? 'Criando...' : 'Criar plano'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
