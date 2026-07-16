import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Breadcrumb, PageHeader } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Badge, Button, Card, ErrorBanner, Field, Select } from '../components/ui';
import {
  ApiError,
  clientsApi,
  postsApi,
  projectsApi,
  type Client,
  type Post,
  type PostFormat,
  type PostStatus,
  type Project,
} from '../lib/api';
import shared from './shared.module.css';
import s from './ProjectDetailPage.module.css';

const FORMAT_LABEL: Record<PostFormat, string> = {
  reel: 'Reel',
  carrossel: 'Carrossel',
  estatico: 'Estático',
};

const STATUS_LABEL: Record<PostStatus, string> = {
  draft: 'Rascunho',
  ai_processing: 'Analisando com IA...',
  ai_generated: 'IA gerou o conteúdo',
  ready_to_render: 'Pronto pra render',
  pending_approval: 'Aguardando aprovação',
  approved: 'Aprovado',
  change_requested: 'Ajuste pedido',
  rendered: 'Renderizado',
};

const STATUS_TONE: Record<PostStatus, 'neutral' | 'accent' | 'success' | 'danger'> = {
  draft: 'neutral',
  ai_processing: 'accent',
  ai_generated: 'accent',
  ready_to_render: 'accent',
  pending_approval: 'accent',
  approved: 'success',
  change_requested: 'danger',
  rendered: 'success',
};

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Algo deu errado.';
}

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [rendering, setRendering] = useState(false);
  const pollRef = useRef<number | null>(null);

  function reload() {
    if (!projectId) return;
    projectsApi
      .get(projectId)
      .then((p) => {
        setProject(p);
        return clientsApi.get(p.clientId);
      })
      .then(setClient)
      .catch((err) => setError(errMsg(err)));
    postsApi
      .listByProject(projectId)
      .then(setPosts)
      .catch((err) => setError(errMsg(err)));
  }

  useEffect(reload, [projectId]);

  // Encerra o polling se sair da página no meio de um render.
  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  async function handleRenderPdf() {
    if (!projectId) return;
    setError('');
    setRendering(true);
    try {
      await projectsApi.renderPdf(projectId);
      // O render é assíncrono (fila -> worker com Puppeteer) — faz
      // polling simples até o pdfUrl aparecer, em vez de fingir que é
      // síncrono.
      pollRef.current = window.setInterval(async () => {
        const updated = await projectsApi.get(projectId);
        if (updated.pdfUrl) {
          setProject(updated);
          setRendering(false);
          if (pollRef.current) window.clearInterval(pollRef.current);
        }
      }, 4000);
      // Timeout de segurança — não fica girando pra sempre se algo travar.
      window.setTimeout(() => {
        if (pollRef.current) {
          window.clearInterval(pollRef.current);
          setRendering(false);
        }
      }, 120_000);
    } catch (err) {
      setError(errMsg(err));
      setRendering(false);
    }
  }

  async function handlePublish() {
    if (!projectId) return;
    setError('');
    try {
      const updated = await projectsApi.publish(projectId);
      setProject(updated);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  if (!projectId) return null;

  return (
    <div>
      <Breadcrumb>
        <Link to="/clients">Clientes</Link> <span>/</span>{' '}
        {client ? <Link to={`/clients/${client.id}`}>{client.name}</Link> : '...'} <span>/</span>{' '}
        <span>{project?.title ?? '...'}</span>
      </Breadcrumb>

      <PageHeader
        title={project?.title ?? 'Carregando...'}
        action={
          <div className={s.toolbar} style={{ marginBottom: 0 }}>
            <Button variant="secondary" onClick={handlePublish} disabled={!project || project.status === 'published'}>
              {project?.status === 'published' ? 'Publicado' : 'Publicar'}
            </Button>
            <Button onClick={handleRenderPdf} disabled={rendering || !posts?.length}>
              {rendering ? 'Gerando PDF...' : 'Gerar PDF'}
            </Button>
            <Button variant="secondary" onClick={() => setShowCreate(true)}>
              + Novo post
            </Button>
          </div>
        }
      />

      <ErrorBanner>{error}</ErrorBanner>

      {project?.pdfUrl && (
        <div className={s.pdfCallout}>
          <span className={s.pdfCalloutText}>PDF gerado {project.pdfGeneratedAt ? `em ${new Date(project.pdfGeneratedAt).toLocaleString('pt-BR')}` : ''}</span>
          <a href={project.pdfUrl} target="_blank" rel="noreferrer">
            <Button variant="secondary">Abrir PDF ↗</Button>
          </a>
        </div>
      )}

      {posts?.length === 0 && (
        <div className={shared.emptyState}>
          <h3>Nenhum post ainda</h3>
          <p>Adicione o primeiro post pra começar a montar a grade.</p>
          <Button onClick={() => setShowCreate(true)}>+ Novo post</Button>
        </div>
      )}

      {posts && posts.length > 0 && (
        <div className={s.postList}>
          {posts
            .slice()
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((post) => (
              <Link key={post.id} to={`/posts/${post.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Card hover className={s.postRow}>
                  <span className={s.postOrder}>{post.orderIndex + 1}</span>
                  <div className={s.postInfo}>
                    <div className={s.postFormat}>{FORMAT_LABEL[post.format]}</div>
                    <div className={s.postCaption}>{post.caption || 'Sem legenda ainda'}</div>
                  </div>
                  <Badge tone={STATUS_TONE[post.status]}>{STATUS_LABEL[post.status]}</Badge>
                </Card>
              </Link>
            ))}
        </div>
      )}

      {showCreate && (
        <CreatePostModal
          projectId={projectId}
          nextOrderIndex={posts?.length ?? 0}
          onClose={() => setShowCreate(false)}
          onCreated={reload}
        />
      )}
    </div>
  );
}

function CreatePostModal({
  projectId,
  nextOrderIndex,
  onClose,
  onCreated,
}: {
  projectId: string;
  nextOrderIndex: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [format, setFormat] = useState<PostFormat>('estatico');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await postsApi.create(projectId, { format, orderIndex: nextOrderIndex });
      onCreated();
      onClose();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Novo post" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <ErrorBanner>{error}</ErrorBanner>

        <Field label="Formato" hint="Define quantas mídias o post vai precisar">
          <Select value={format} onChange={(e) => setFormat(e.target.value as PostFormat)}>
            <option value="estatico">Estático (1 imagem)</option>
            <option value="carrossel">Carrossel (várias imagens)</option>
            <option value="reel">Reel (capa + vídeo)</option>
          </Select>
        </Field>

        <div className={shared.modalActions}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Criando...' : 'Criar post'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
