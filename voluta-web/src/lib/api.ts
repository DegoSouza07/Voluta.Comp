// Base da API. Em produção isso vem de uma env var do Vite
// (VITE_API_BASE_URL) — ver .env.example.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function getToken(): string | null {
  return localStorage.getItem('voluta_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    // Sessão expirada/token inválido — manda pro login. Não tenta
    // adivinhar se dá pra recuperar, o backend já disse que não.
    localStorage.removeItem('voluta_token');
    window.location.hash = '#/login';
    throw new ApiError(401, 'Sessão expirada. Faça login de novo.');
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    const message =
      typeof body?.message === 'string'
        ? body.message
        : body?.message?.message || body?.message?.[0] || 'Erro inesperado.';
    throw new ApiError(res.status, message);
  }

  return body as T;
}

// ---------- Tipos (espelham as entidades reais da API) ----------

export type UserRole = 'voluta_admin' | 'voluta_editor' | 'client_viewer';
export type PostFormat = 'reel' | 'carrossel' | 'estatico';
export type PostMediaKind = 'cover' | 'reel' | 'slide';
export type PostStatus =
  | 'draft' | 'ai_processing' | 'ai_generated' | 'ready_to_render'
  | 'pending_approval' | 'approved' | 'change_requested' | 'rendered';
export type ProjectStatus = 'planning' | 'in_review' | 'approved' | 'published' | 'archived';
export type FunnelStage = 'descoberta' | 'consideracao' | 'decisao';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  clientId: string | null;
}

export interface Client {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  instagramHandle: string | null;
  websiteLabel: string | null;
  brandColors: Record<string, string>;
  brandFonts: Record<string, string>;
  toneOfVoice: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  clientId: string;
  title: string;
  referenceMonth: string;
  status: ProjectStatus;
  coverImageUrl: string | null;
  publicSlug: string | null;
  pdfUrl: string | null;
  pdfGeneratedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PostMedia {
  id: string;
  postId: string;
  kind: PostMediaKind;
  orderIndex: number;
  originalUrl: string;
  variants: { thumbnail?: string; preview?: string; render_ready?: string };
  createdAt: string;
}

export interface Post {
  id: string;
  projectId: string;
  orderIndex: number;
  format: PostFormat;
  publishDate: string | null;
  weekday: string | null;
  caption: string | null;
  editorialLine: string | null;
  funnelStage: FunnelStage | null;
  emotion: string | null;
  tags: string[];
  userContextInput: string | null;
  status: PostStatus;
  media: PostMedia[];
  createdAt: string;
  updatedAt: string;
}

// ---------- Auth ----------

export const authApi = {
  login: (email: string, password: string) =>
    request<{ accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: (token: string) =>
    request<AuthenticatedUser>('/auth/me', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),
};

// ---------- Clients ----------

export const clientsApi = {
  list: () => request<Client[]>('/clients'),
  get: (id: string) => request<Client>(`/clients/${id}`),
  create: (data: {
    name: string;
    slug: string;
    instagramHandle?: string;
    websiteLabel?: string;
    toneOfVoice?: string;
    brandColors?: Record<string, string>;
  }) => request<Client>('/clients', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Client>) =>
    request<Client>(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deactivate: (id: string) => request<void>(`/clients/${id}`, { method: 'DELETE' }),
};

// ---------- Projects ----------

export const projectsApi = {
  listByClient: (clientId: string) => request<Project[]>(`/projects/by-client/${clientId}`),
  get: (id: string) => request<Project>(`/projects/${id}`),
  create: (data: { clientId: string; title: string; referenceMonth: string }) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  publish: (id: string) => request<Project>(`/projects/${id}/publish`, { method: 'PATCH' }),
  renderPdf: (id: string) =>
    request<{ queued: boolean; projectId: string }>(`/projects/${id}/render-pdf`, { method: 'POST' }),
  remove: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
};

// ---------- Posts ----------

export const postsApi = {
  listByProject: (projectId: string) => request<Post[]>(`/projects/${projectId}/posts`),
  get: (id: string) => request<Post>(`/posts/${id}`),
  create: (projectId: string, data: { format: PostFormat; orderIndex: number }) =>
    request<Post>(`/projects/${projectId}/posts`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Post> & { userContextInput?: string }) =>
    request<Post>(`/posts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  reorder: (projectId: string, items: { id: string; orderIndex: number }[]) =>
    request<Post[]>(`/projects/${projectId}/posts/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ items }),
    }),
};

// ---------- Media ----------

export const mediaApi = {
  createUploadUrl: (
    postId: string,
    data: { filename: string; contentType: string; kind: PostMediaKind; orderIndex: number },
  ) =>
    request<{ postMediaId: string; uploadUrl: string; originalUrl: string }>(
      `/posts/${postId}/media/upload-url`,
      { method: 'POST', body: JSON.stringify(data) },
    ),
  confirmUpload: (postId: string, postMediaId: string) =>
    request<{ queued: boolean }>(`/posts/${postId}/media/${postMediaId}/confirm-upload`, {
      method: 'POST',
    }),
  deleteMedia: (postId: string, postMediaId: string) =>
    request<void>(`/posts/${postId}/media/${postMediaId}`, { method: 'DELETE' }),
  // Upload direto pro bucket — não passa pela nossa API (Etapa 1: nunca
  // proxy de arquivo pesado pelo servidor de aplicação).
  uploadFile: async (uploadUrl: string, file: File) => {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });
    if (!res.ok) throw new ApiError(res.status, 'Falha no upload do arquivo pro bucket.');
  },
};

export { getToken };

export interface PublicPlan extends Project {
  client: Client;
  posts: Post[];
}

export const publicApi = {
  getPlan: (slug: string) => request<PublicPlan>(`/public/plano/${slug}`),
  submitApproval: (
    postId: string,
    data: { action: 'approved' | 'change_requested'; comment?: string; clientIdentifier: string },
  ) => request<void>(`/public/posts/${postId}/approval`, { method: 'POST', body: JSON.stringify(data) }),
};
 
 export interface PostApproval {
  id: string;
  postId: string;
  action: 'approved' | 'change_requested';
  comment: string | null;
  clientIdentifier: string;
  createdAt: string;
}

export const approvalsApi = {
  listByPost: (postId: string) => request<PostApproval[]>(`/posts/${postId}/approvals`),
};
