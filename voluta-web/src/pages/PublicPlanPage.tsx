import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, publicApi, type Post, type PostMediaKind, type PublicPlan } from '../lib/api';
import { Badge, Button, TextArea } from '../components/ui';
import s from './PublicPlanPage.module.css';

const FORMAT_LABEL: Record<Post['format'], string> = {
  reel: 'Reel',
  carrossel: 'Carrossel',
  estatico: 'Estático',
};

// cover (capa do reel) sempre antes do vídeo do reel; slides seguem a
// própria orderIndex. Cover/reel dividem orderIndex=0, por isso o
// desempate por kind é necessário.
const KIND_ORDER: Record<PostMediaKind, number> = { cover: 0, slide: 1, reel: 2 };

function sortedMedia(post: Post) {
  return [...post.media].sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
    return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  });
}

function imageSrc(media: Post['media'][number]): string {
  return media.variants.render_ready ?? media.variants.preview ?? media.originalUrl;
}

export function PublicPlanPage() {
  const { slug } = useParams<{ slug: string }>();
  const [plan, setPlan] = useState<PublicPlan | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [clientIdentifier, setClientIdentifier] = useState('');

  const reload = useCallback(() => {
    if (!slug) return;
    publicApi
      .getPlan(slug)
      .then(setPlan)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
      });
  }, [slug]);

  useEffect(reload, [reload]);

  if (notFound) {
    return (
      <div className={s.page}>
        <div className={s.notFound}>
          <h2>Plano não encontrado</h2>
          <p>Esse link pode ter expirado ou o endereço está incorreto.</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className={s.page}>
        <span className={s.loadingLine}>Carregando...</span>
      </div>
    );
  }

  const posts = [...plan.posts].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className={s.page}>
      <header className={s.header}>
        <span className={s.eyebrow}>Plano Visual</span>
        <h1>{plan.client.name}</h1>
        <p className={s.subtitle}>{plan.title}</p>
      </header>

      <div className={s.nameBar}>
        <label className={s.nameLabel} htmlFor="clientIdentifier">
          Seu nome, pra identificar seus comentários
        </label>
        <input
          id="clientIdentifier"
          className={s.commentBox}
          value={clientIdentifier}
          onChange={(e) => setClientIdentifier(e.target.value)}
          placeholder="Ex: Ana (Casa Pla)"
        />
      </div>

      <div className={s.postsList}>
        {posts.map((post) => (
          <PostApprovalCard
            key={post.id}
            post={post}
            clientIdentifier={clientIdentifier}
            onSubmitted={reload}
          />
        ))}
      </div>
    </div>
  );
}

function PostApprovalCard({
  post,
  clientIdentifier,
  onSubmitted,
}: {
  post: Post;
  clientIdentifier: string;
  onSubmitted: () => void;
}) {
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const alreadyResolved = post.status === 'approved' || post.status === 'change_requested';

  async function submit(action: 'approved' | 'change_requested') {
    if (!clientIdentifier.trim()) {
      setError('Preenche seu nome ali em cima antes de responder.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await publicApi.submitApproval(post.id, {
        action,
        comment: comment.trim() || undefined,
        clientIdentifier: clientIdentifier.trim(),
      });
      setShowComment(false);
      setComment('');
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Algo deu errado, tenta de novo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={s.postCard}>
      <div className={s.postHeader}>
        <span className={s.postTitle}>
          Post {post.orderIndex + 1} — {FORMAT_LABEL[post.format]}
        </span>
        {post.status === 'approved' && <Badge tone="success">Aprovado</Badge>}
        {post.status === 'change_requested' && <Badge tone="danger">Ajuste pedido</Badge>}
      </div>

      <div className={s.mediaRow}>
        {sortedMedia(post).map((media) =>
          media.kind === 'reel' ? (
            <video key={media.id} src={media.originalUrl} controls className={s.mediaVideo} />
          ) : (
            <img key={media.id} src={imageSrc(media)} alt="" className={s.mediaImg} />
          ),
        )}
      </div>

      {post.caption && <p className={s.caption}>{post.caption}</p>}

      {error && <div className={s.formError}>{error}</div>}

      {!alreadyResolved || showComment ? (
        <>
          {showComment && (
            <TextArea
              className={s.commentBox}
              rows={3}
              placeholder="Conta o que você gostaria de ajustar (opcional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          )}
          <div className={showComment ? s.commentActions : s.actions}>
            {!showComment && (
              <>
                <Button variant="primary" onClick={() => submit('approved')} disabled={submitting}>
                  Aprovar
                </Button>
                <Button variant="secondary" onClick={() => setShowComment(true)} disabled={submitting}>
                  Pedir ajuste
                </Button>
              </>
            )}
            {showComment && (
              <>
                <Button variant="ghost" onClick={() => setShowComment(false)} disabled={submitting}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  onClick={() => submit('change_requested')}
                  disabled={submitting}
                >
                  {submitting ? 'Enviando...' : 'Enviar pedido de ajuste'}
                </Button>
              </>
            )}
          </div>
        </>
      ) : (
        <div className={s.resolvedNote}>
          Você já respondeu esse post. Se quiser mudar sua resposta,{' '}
          <button
            type="button"
            onClick={() => setShowComment(true)}
            style={{ background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0, color: 'inherit' }}
          >
            clique aqui
          </button>
          .
        </div>
      )}
    </div>
  );
}