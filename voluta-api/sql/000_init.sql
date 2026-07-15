-- ========== EXTENSÕES ==========
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========== ENUMS ==========
CREATE TYPE user_role AS ENUM ('voluta_admin', 'voluta_editor', 'client_viewer');
CREATE TYPE post_format AS ENUM ('reel', 'carrossel', 'estatico');
CREATE TYPE funnel_stage AS ENUM ('descoberta', 'consideracao', 'decisao');
CREATE TYPE post_status AS ENUM (
  'draft', 'ai_processing', 'ai_generated', 'ready_to_render',
  'pending_approval', 'approved', 'change_requested', 'rendered'
);
CREATE TYPE project_status AS ENUM ('planning', 'in_review', 'approved', 'published', 'archived');

-- ========== CLIENTES ==========
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  instagram_handle VARCHAR(100),
  website_label VARCHAR(255),
  brand_colors JSONB NOT NULL DEFAULT '{}',
  brand_fonts JSONB NOT NULL DEFAULT '{}',
  tone_of_voice TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== USUÁRIOS ==========
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'voluta_editor',
  password_hash TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_client_id ON users(client_id);

-- ========== PROJETOS ==========
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  reference_month DATE NOT NULL,
  status project_status NOT NULL DEFAULT 'planning',
  cover_image_url TEXT,
  public_slug VARCHAR(64) UNIQUE,
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_public_slug ON projects(public_slug);

-- ========== POSTS ==========
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  format post_format NOT NULL,
  publish_date DATE,
  weekday VARCHAR(20),
  media_original_url TEXT NOT NULL,
  media_variants JSONB NOT NULL DEFAULT '{}',
  caption TEXT,
  editorial_line VARCHAR(100),
  funnel_stage funnel_stage,
  emotion VARCHAR(100),
  tags TEXT[] DEFAULT '{}',
  user_context_input TEXT,
  ai_raw_response JSONB,
  status post_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_project_order UNIQUE (project_id, order_index)
);
CREATE INDEX idx_posts_project_id ON posts(project_id);
CREATE INDEX idx_posts_status ON posts(status);

-- ========== APROVAÇÕES ==========
CREATE TABLE post_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL CHECK (action IN ('approved', 'change_requested')),
  comment TEXT,
  client_identifier VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_post_approvals_post_id ON post_approvals(post_id);

-- ========== WEBHOOKS ==========
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  delivered BOOLEAN NOT NULL DEFAULT false,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== SEED: usuário admin inicial ==========
-- senha: "trocar123" (hash bcrypt real, gerado com bcrypt.hash('trocar123', 10))
-- TROCAR essa senha assim que fizer o primeiro login em produção.
INSERT INTO users (email, name, role, password_hash)
VALUES (
  'diego@voluta.company',
  'Diego',
  'voluta_admin',
  '$2b$10$aIKjZZdr.XoP1ypHVDB/b.Ft8UY3bUaal.MNYyBJ.7Tx/Sw95tT/y'
);
