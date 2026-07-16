import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Breadcrumb, PageHeader } from '../components/Layout';
import { Badge, Button, Field, Select, TextArea, TextInput } from '../components/ui';
import {
  ApiError,
  mediaApi,
  postsApi,
  type FunnelStage,
  type Post,
  type PostMediaKind,
  type PostStatus,
} from '../lib/api';
import s from './PostDetailPage.module.css';

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

interface Slot {
  kind: PostMediaKind;
  orderIndex: number;
  label: string;
}

function slotsForPost(post: Post): Slot[] {
  if (post.format === 'reel') {
    return [
      { kind: 'cover', orderIndex: 0, label: 'Capa' },
      { kind: 'reel', orderIndex: 0, label: 'Reel' },
    ];
  }
  if (post.format === 'estatico') {
    return [{ kind: 'slide', orderIndex: 0, label: 'Imagem' }];
  }
  // carrossel — 1 slot por slide já existente, sempre em ordem
  const existing = post.media
    .filter((m) => m.kind === 'slide')
    .sort((a, b) => a.orderIndex - b.orderIndex);
  return existing.map((m, i) => ({ kind: 'slide', orderIndex: m.orderIndex, label: `Slide ${i + 1}` }));
}

export function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState('');
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!postId) return;
    postsApi.get(postId).then(setPost).catch((err) => setError(errMsg(err)));
  }, [postId]);

  useEffect(reload, [reload]);

  // Enquanto o post está em ai_processing, faz polling até sair desse
  // estado — evita o usuário achar que travou.
  useEffect(() => {
    if (post?.status !== 'ai_processing') return;
    const interval = window.setInterval(reload, 4000);
    return () => window.clearInterval(interval);
  }, [post?.status, reload]);

  async function handleFileSelected(kind: PostMediaKind, orderIndex: number, file: File) {
    if (!postId) return;
    const key = `${kind}-${orderIndex}`;
    setError('');
    setUploadingKey(key);
    try {
      const { postMediaId, uploadUrl } = await mediaApi.createUploadUrl(postId, {
        filename: file.name,
        contentType: file.type,
        kind,
        orderIndex,
      });
      await mediaApi.uploadFile(uploadUrl, file);
      await mediaApi.confirmUpload(postId, postMediaId);
      reload();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setUploadingKey(null);
    }
  }

  async function handleAddSlide() {
    if (!post || !postId) return;
    const nextIndex = post.media.filter((m) => m.kind === 'slide').length;
    // Só cria o slot quando o usuário escolher o arquivo — o input abre
    // direto (ver renderSlot com key dinâmica).
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) handleFileSelected('slide', nextIndex, file);
    };
    input.click();
  }

  if (!post) {
    return (
      <div>
        <ErrorBannerInline>{error}</ErrorBannerInline>
      </div>
    );
  }

  const slots = slotsForPost(post);

  return (
    <div>
      <Breadcrumb>
        <Link to={`/projects/${post.projectId}`}>Projeto</Link> <span>/</span> <span>Post {post.orderIndex + 1}</span>
      </Breadcrumb>

      <PageHeader
        title={`Post ${post.orderIndex + 1} — ${post.format === 'estatico' ? 'Estático' : post.format === 'reel' ? 'Reel' : 'Carrossel'}`}
        action={<Badge tone={STATUS_TONE[post.status]}>{STATUS_LABEL[post.status]}</Badge>}
      />

      <ErrorBannerInline>{error}</ErrorBannerInline>

      <div className={s.layout}>
        <div>
          <div className={s.sectionTitle}>Mídia</div>
          <div className={s.slotGrid}>
            {slots.map((slot) => (
              <MediaSlot
                key={`${slot.kind}-${slot.orderIndex}`}
                slot={slot}
                post={post}
                uploading={uploadingKey === `${slot.kind}-${slot.orderIndex}`}
                onFileSelected={(file) => handleFileSelected(slot.kind, slot.orderIndex, file)}
              />
            ))}
            {post.format === 'carrossel' && (
              <button className={s.addSlideButton} onClick={handleAddSlide} type="button" title="Adicionar slide">
                +
              </button>
            )}
          </div>

          <div className={s.sectionTitle}>Contexto pra IA</div>
          <PostContextField post={post} onSaved={setPost} />
        </div>

        <div>
          <div className={s.sectionTitle}>Conteúdo</div>
          <PostFieldsForm post={post} onSaved={setPost} />
        </div>
      </div>
    </div>
  );
}

function ErrorBannerInline({ children }: { children: string }) {
  if (!children) return null;
  return (
    <div style={{ color: 'var(--color-danger)', fontSize: 13.5, marginBottom: 20 }} role="alert">
      {children}
    </div>
  );
}

function MediaSlot({
  slot,
  post,
  uploading,
  onFileSelected,
}: {
  slot: Slot;
  post: Post;
  uploading: boolean;
  onFileSelected: (file: File) => void;
}) {
  const existing = post.media.find((m) => m.kind === slot.kind && m.orderIndex === slot.orderIndex);
  const inputRef = useRef<HTMLInputElement>(null);
  const thumb = existing?.variants.thumbnail ?? existing?.originalUrl;
  const isProcessed = !!existing?.variants.thumbnail;

  return (
    <div className={`${s.slot} ${existing ? s.slotFilled : ''}`}>
      <span className={s.slotLabel}>{slot.label}</span>

      {thumb ? (
        <img src={thumb} alt={slot.label} className={s.slotImg} />
      ) : (
        <label className={s.slotEmptyLabel}>
          {uploading ? 'Enviando...' : '+ Enviar imagem'}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className={s.slotInput}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileSelected(file);
            }}
          />
        </label>
      )}

      {existing && !isProcessed && <span className={s.slotStatus}>processando...</span>}
    </div>
  );
}

function PostContextField({ post, onSaved }: { post: Post; onSaved: (p: Post) => void }) {
  const [value, setValue] = useState(post.userContextInput ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setValue(post.userContextInput ?? ''), [post.id]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await postsApi.update(post.id, { userContextInput: value });
      onSaved(updated);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <Field label="" hint="Um contexto rápido pra ajudar a IA a escrever a legenda (ex: 'sofá amarelo da sala de estar')">
        <TextArea value={value} onChange={(e) => setValue(e.target.value)} rows={3} />
      </Field>
      <div className={s.saveRow}>
        <Button variant="secondary" onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar contexto'}
        </Button>
        {saved && <span className={s.savedHint}>Salvo.</span>}
      </div>
    </div>
  );
}

const FUNNEL_OPTIONS: { value: FunnelStage; label: string }[] = [
  { value: 'descoberta', label: 'Descoberta' },
  { value: 'consideracao', label: 'Consideração' },
  { value: 'decisao', label: 'Decisão' },
];

function PostFieldsForm({ post, onSaved }: { post: Post; onSaved: (p: Post) => void }) {
  const [caption, setCaption] = useState(post.caption ?? '');
  const [editorialLine, setEditorialLine] = useState(post.editorialLine ?? '');
  const [emotion, setEmotion] = useState(post.emotion ?? '');
  const [funnelStage, setFunnelStage] = useState<FunnelStage | ''>(post.funnelStage ?? '');
  const [publishDate, setPublishDate] = useState(post.publishDate ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCaption(post.caption ?? '');
    setEditorialLine(post.editorialLine ?? '');
    setEmotion(post.emotion ?? '');
    setFunnelStage(post.funnelStage ?? '');
    setPublishDate(post.publishDate ?? '');
  }, [post.id, post.updatedAt]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await postsApi.update(post.id, {
        caption,
        editorialLine,
        emotion,
        funnelStage: funnelStage || undefined,
        publishDate: publishDate || undefined,
      });
      onSaved(updated);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Field label="Legenda" hint={post.status === 'ai_processing' ? 'A IA ainda está gerando...' : undefined}>
        <TextArea rows={7} value={caption} onChange={(e) => setCaption(e.target.value)} />
      </Field>

      <div className={s.metaGrid}>
        <Field label="Editoria">
          <TextInput value={editorialLine} onChange={(e) => setEditorialLine(e.target.value)} />
        </Field>
        <Field label="Emoção">
          <TextInput value={emotion} onChange={(e) => setEmotion(e.target.value)} />
        </Field>
        <Field label="Etapa do funil">
          <Select value={funnelStage} onChange={(e) => setFunnelStage(e.target.value as FunnelStage)}>
            <option value="">—</option>
            {FUNNEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Data de publicação">
          <TextInput type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} />
        </Field>
      </div>

      <div className={s.saveRow}>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
        {saved && <span className={s.savedHint}>Salvo.</span>}
      </div>
    </div>
  );
}
