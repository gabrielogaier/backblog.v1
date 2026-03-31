-- Schema base do CMS Backblog.
-- Execute este arquivo conectado ao banco `backblog`
--   psql -U gabriel -d backblog -f blog/server/schema.sql

BEGIN;

-- ========================
-- Tipos e funções auxiliares
-- ========================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_status') THEN
        CREATE TYPE post_status AS ENUM ('draft', 'published');
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'revision_source') THEN
        CREATE TYPE revision_source AS ENUM ('human', 'ai');
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_role') THEN
        CREATE TYPE conversation_role AS ENUM ('user', 'ai', 'system');
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comment_status') THEN
        CREATE TYPE comment_status AS ENUM ('pending', 'approved', 'hidden');
    END IF;
END$$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================
-- Tabelas principais
-- ========================

CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    name            VARCHAR(120),
    role            VARCHAR(32) NOT NULL DEFAULT 'admin',
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_workspaces (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    root_path   TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blog_settings (
    id                BIGSERIAL PRIMARY KEY,
    user_id           BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    blog_name         VARCHAR(120) NOT NULL DEFAULT 'Meu Blog',
    blog_tagline      VARCHAR(180),
    theme_primary     VARCHAR(20) NOT NULL DEFAULT '#0f172a',
    theme_secondary   VARCHAR(20) NOT NULL DEFAULT '#14b8a6',
    background_color  VARCHAR(20) NOT NULL DEFAULT '#ffffff',
    text_color        VARCHAR(20) NOT NULL DEFAULT '#0f172a',
    accent_color      VARCHAR(20) NOT NULL DEFAULT '#14b8a6',
    code_block_bg_color  VARCHAR(20) NOT NULL DEFAULT '#0f172a',
    code_inline_bg_color VARCHAR(20) NOT NULL DEFAULT '#1e293b',
    code_text_color      VARCHAR(20) NOT NULL DEFAULT '#e2e8f0',
    code_keyword_color   VARCHAR(20) NOT NULL DEFAULT '#7dd3fc',
    code_string_color    VARCHAR(20) NOT NULL DEFAULT '#86efac',
    code_number_color    VARCHAR(20) NOT NULL DEFAULT '#fbbf24',
    code_comment_color   VARCHAR(20) NOT NULL DEFAULT '#94a3b8',
    code_function_color  VARCHAR(20) NOT NULL DEFAULT '#c4b5fd',
    about_text        TEXT,
    contact_email     VARCHAR(120),
    social_links      JSONB DEFAULT '[]'::JSONB,
    seo_description   VARCHAR(180),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE blog_settings
    ADD COLUMN IF NOT EXISTS code_block_bg_color VARCHAR(20) NOT NULL DEFAULT '#0f172a';

ALTER TABLE blog_settings
    ADD COLUMN IF NOT EXISTS code_inline_bg_color VARCHAR(20) NOT NULL DEFAULT '#1e293b';

ALTER TABLE blog_settings
    ADD COLUMN IF NOT EXISTS code_text_color VARCHAR(20) NOT NULL DEFAULT '#e2e8f0';

ALTER TABLE blog_settings
    ADD COLUMN IF NOT EXISTS code_keyword_color VARCHAR(20) NOT NULL DEFAULT '#7dd3fc';

ALTER TABLE blog_settings
    ADD COLUMN IF NOT EXISTS code_string_color VARCHAR(20) NOT NULL DEFAULT '#86efac';

ALTER TABLE blog_settings
    ADD COLUMN IF NOT EXISTS code_number_color VARCHAR(20) NOT NULL DEFAULT '#fbbf24';

ALTER TABLE blog_settings
    ADD COLUMN IF NOT EXISTS code_comment_color VARCHAR(20) NOT NULL DEFAULT '#94a3b8';

ALTER TABLE blog_settings
    ADD COLUMN IF NOT EXISTS code_function_color VARCHAR(20) NOT NULL DEFAULT '#c4b5fd';

CREATE TABLE IF NOT EXISTS user_profiles (
    id                BIGSERIAL PRIMARY KEY,
    user_id           BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    display_name      VARCHAR(120),
    slug              VARCHAR(120),
    short_description TEXT,
    ai_instruction    TEXT,
    ai_alignment      JSONB DEFAULT '{}'::JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_indexes
         WHERE schemaname = CURRENT_SCHEMA()
           AND indexname = 'user_profiles_slug_ci_idx'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
              FROM user_profiles
             WHERE slug IS NOT NULL
             GROUP BY LOWER(slug)
            HAVING COUNT(*) > 1
        ) THEN
            EXECUTE '
                CREATE UNIQUE INDEX user_profiles_slug_ci_idx
                    ON user_profiles (LOWER(slug))
                    WHERE slug IS NOT NULL
            ';
        END IF;
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS sessions (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token_hash  TEXT NOT NULL,
    refresh_token_hash  TEXT,
    user_agent          TEXT,
    ip_address          INET,
    expires_at          TIMESTAMPTZ NOT NULL,
    refresh_expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_idx ON sessions (session_token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_refresh_token_idx ON sessions (refresh_token_hash);

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS refresh_expires_at TIMESTAMPTZ;

ALTER TABLE sessions
    ALTER COLUMN refresh_token_hash SET NOT NULL;

ALTER TABLE sessions
    ALTER COLUMN refresh_expires_at SET DEFAULT NOW();

ALTER TABLE sessions
    ALTER COLUMN refresh_expires_at SET NOT NULL;

UPDATE sessions
   SET refresh_expires_at = NOW()
 WHERE refresh_expires_at IS NULL;

CREATE TABLE IF NOT EXISTS instructions (
    id                BIGSERIAL PRIMARY KEY,
    owner_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title             VARCHAR(160) NOT NULL,
    body              TEXT NOT NULL,
    priority_keywords TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    is_default        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE instructions
    ADD COLUMN IF NOT EXISTS owner_id BIGINT REFERENCES users(id) ON DELETE CASCADE;

UPDATE instructions
   SET owner_id = (SELECT id FROM users ORDER BY id LIMIT 1)
 WHERE owner_id IS NULL
   AND EXISTS (SELECT 1 FROM users);

DROP INDEX IF EXISTS instructions_default_idx;
CREATE UNIQUE INDEX IF NOT EXISTS instructions_owner_default_idx
    ON instructions(owner_id) WHERE is_default;
CREATE INDEX IF NOT EXISTS instructions_owner_idx ON instructions (owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS instruction_versions (
    id              BIGSERIAL PRIMARY KEY,
    instruction_id  BIGINT NOT NULL REFERENCES instructions(id) ON DELETE CASCADE,
    version_number  INTEGER NOT NULL DEFAULT 1,
    title           VARCHAR(160) NOT NULL,
    body            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (instruction_id, version_number)
);

CREATE TABLE IF NOT EXISTS posts (
    id              BIGSERIAL PRIMARY KEY,
    author_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
    instruction_id  BIGINT REFERENCES instructions(id) ON DELETE SET NULL,
    title           TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    excerpt         TEXT,
    content_raw     TEXT,
    content_final   TEXT,
    status          post_status NOT NULL DEFAULT 'draft',
    reading_time_min SMALLINT,
    published_at    TIMESTAMPTZ,
    year            INTEGER,
    month           INTEGER,
    day             INTEGER,
    search_vector   TSVECTOR GENERATED ALWAYS AS (
                        setweight(to_tsvector('portuguese', COALESCE(title,'')), 'A') ||
                        setweight(to_tsvector('portuguese', COALESCE(content_final,'')), 'B') ||
                        setweight(to_tsvector('portuguese', COALESCE(content_raw,'')), 'C')
                    ) STORED,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT posts_published_requires_date
        CHECK (status <> 'published' OR published_at IS NOT NULL),
    CONSTRAINT posts_year_month_day_check
        CHECK (
            (year IS NULL AND month IS NULL AND day IS NULL)
            OR (year BETWEEN 2000 AND 2100 AND month BETWEEN 1 AND 12 AND day BETWEEN 1 AND 31)
        )
);

CREATE INDEX IF NOT EXISTS posts_archive_idx
    ON posts (year, month, status) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS posts_published_at_idx
    ON posts (published_at DESC) WHERE published_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS posts_search_idx
    ON posts USING GIN (search_vector);

CREATE TABLE IF NOT EXISTS post_revisions (
    id              BIGSERIAL PRIMARY KEY,
    post_id         BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    source          revision_source NOT NULL,
    content         TEXT NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS post_revisions_post_idx ON post_revisions (post_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tags (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(80) NOT NULL,
    slug        VARCHAR(120) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(slug)
);
CREATE UNIQUE INDEX IF NOT EXISTS tags_name_ci_idx ON tags (LOWER(name));

CREATE TABLE IF NOT EXISTS post_tags (
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag_id  BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);
CREATE INDEX IF NOT EXISTS post_tags_tag_idx ON post_tags (tag_id);

CREATE TABLE IF NOT EXISTS post_likes (
    id               BIGSERIAL PRIMARY KEY,
    post_id          BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    fingerprint_hash CHAR(64) NOT NULL,
    ip_address       INET,
    user_agent       TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (post_id, fingerprint_hash)
);
CREATE INDEX IF NOT EXISTS post_likes_post_idx ON post_likes (post_id);

CREATE TABLE IF NOT EXISTS post_comments (
    id            BIGSERIAL PRIMARY KEY,
    post_id       BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_name   VARCHAR(120),
    author_email  VARCHAR(180),
    content       TEXT NOT NULL,
    status        comment_status NOT NULL DEFAULT 'pending',
    metadata      JSONB DEFAULT '{}'::JSONB,
    ip_address    INET,
    user_agent    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS post_comments_post_idx ON post_comments (post_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS conversations (
    id          BIGSERIAL PRIMARY KEY,
    post_id     BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    owner_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    title       TEXT,
    status      VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS conversations_post_idx ON conversations (post_id);

CREATE TABLE IF NOT EXISTS conversation_messages (
    id              BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            conversation_role NOT NULL,
    content         TEXT NOT NULL,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS conversation_messages_conv_idx ON conversation_messages (conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_generation_logs (
    id               BIGSERIAL PRIMARY KEY,
    post_id          BIGINT REFERENCES posts(id) ON DELETE SET NULL,
    conversation_id  BIGINT REFERENCES conversations(id) ON DELETE SET NULL,
    instruction_id   BIGINT REFERENCES instructions(id) ON DELETE SET NULL,
    model            VARCHAR(60) NOT NULL,
    prompt_tokens    INTEGER,
    completion_tokens INTEGER,
    cost_usd         NUMERIC(10,4),
    latency_ms       INTEGER,
    status           VARCHAR(32) NOT NULL DEFAULT 'success',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_generation_logs
    ADD COLUMN IF NOT EXISTS conversation_id BIGINT REFERENCES conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ai_generation_logs_post_idx ON ai_generation_logs (post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_generation_logs_conversation_idx ON ai_generation_logs (conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(64) NOT NULL,
    meta        JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action, created_at DESC);

-- ========================
-- Triggers de atualização automática
-- ========================

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS instructions_set_updated_at ON instructions;
CREATE TRIGGER instructions_set_updated_at
    BEFORE UPDATE ON instructions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS posts_set_updated_at ON posts;
CREATE TRIGGER posts_set_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS user_profiles_set_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_set_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
