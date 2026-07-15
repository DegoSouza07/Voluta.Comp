-- Resolve a lacuna documentada no README: posts guardava 1 mídia só,
-- mas Reel precisa de 2 (capa != frame do vídeo) e Carrossel precisa de N.

CREATE TYPE post_media_kind AS ENUM ('cover', 'reel', 'slide');

CREATE TABLE post_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  kind post_media_kind NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  original_url TEXT NOT NULL,
  variants JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 'cover'/'reel' só existem 1x por post; 'slide' pode ter várias (0..N-1)
  CONSTRAINT uq_post_media_slot UNIQUE (post_id, kind, order_index)
);
CREATE INDEX idx_post_media_post_id ON post_media(post_id);

-- posts deixa de guardar mídia diretamente — agora vive 100% em post_media
ALTER TABLE posts DROP COLUMN IF EXISTS media_original_url;
ALTER TABLE posts DROP COLUMN IF EXISTS media_variants;
