## Backblog Server

API Express do Backblog para autenticação, gestão de posts, IA, perfil do autor, configurações visuais e endpoints públicos.

## Executando localmente

```bash
cd blog/server
npm install
npm run dev
```

Ou em modo direto:

```bash
node backblog.js
```

API padrão: `http://localhost:4010`

## Banco e seed

```bash
psql -U <seu_usuario> -d backblog -f blog/server/schema.sql
cp blog/.env.example blog/.env
node blog/server/seeds/initialSeed.js
```

## Segurança ativa

- `helmet`, `compression` e `cors` configurados
- sessão por cookie `httpOnly` (`sameSite=lax`, `secure` em produção)
- autorização por propriedade de recurso (escopo do usuário autenticado); `admin` representa dono da própria conta, não superadmin global
- rate limit em rotas de autenticação:
  - `POST /api/admin/auth/login`
  - `POST /api/admin/auth/refresh`
  - `POST /api/public/register`
- rate limit em endpoints sensíveis de tráfego:
  - `POST /api/public/posts/:year/:month/:slug/likes`
  - `POST /api/public/posts/:year/:month/:slug/comments`
  - `POST /api/admin/uploads/images`
- proteção de brute force em login com bloqueio temporário por `IP` e por `email` após falhas consecutivas
- upload de imagem com validação de assinatura do arquivo (magic bytes) e MIME permitido
- storage com separação física padrão entre conteúdo público (`STORAGE_PUBLIC_ROOT`) e workspace interno (`STORAGE_PRIVATE_ROOT`)
- proteção CSRF:
  - token em `GET /api/csrf-token`
  - rotas `POST/PUT/PATCH/DELETE` de `/api/admin/*` e `/api/public/*` exigem `X-CSRF-Token`

## Variáveis principais

Definidas em `blog/.env` (base em `blog/.env.example`):

- Banco: `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGSSLMODE`
- Runtime/API: `NODE_ENV`, `HOST`, `PORT`, `API_PREFIX`, `CORS_ORIGIN`
- Sessão/cookies: `SESSION_EXPIRATION_HOURS`, `REFRESH_TOKEN_DAYS`, `SESSION_COOKIE_NAME`, `REFRESH_COOKIE_NAME`
- Política de cookies: `COOKIE_SAME_SITE` (`strict|lax|none`) e `COOKIE_SECURE` (`true|false|auto`)
- CSRF: `CSRF_COOKIE_NAME`, `CSRF_COOKIE_MAX_AGE_MS`, `CSRF_ENFORCE_ORIGIN`
- Segurança auth:
  - `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS`, `AUTH_LOGIN_RATE_LIMIT_MAX`
  - `AUTH_REFRESH_RATE_LIMIT_WINDOW_MS`, `AUTH_REFRESH_RATE_LIMIT_MAX`
  - `AUTH_REGISTER_RATE_LIMIT_WINDOW_MS`, `AUTH_REGISTER_RATE_LIMIT_MAX`
  - `AUTH_BRUTE_FORCE_WINDOW_MS`, `AUTH_BRUTE_FORCE_MAX_FAILURES_PER_IP`
  - `AUTH_BRUTE_FORCE_MAX_FAILURES_PER_EMAIL`, `AUTH_BRUTE_FORCE_BLOCK_DURATION_MS`
- Segurança de tráfego:
  - `PUBLIC_LIKE_RATE_LIMIT_WINDOW_MS`, `PUBLIC_LIKE_RATE_LIMIT_MAX`
  - `PUBLIC_COMMENT_RATE_LIMIT_WINDOW_MS`, `PUBLIC_COMMENT_RATE_LIMIT_MAX`
  - `ADMIN_UPLOAD_RATE_LIMIT_WINDOW_MS`, `ADMIN_UPLOAD_RATE_LIMIT_MAX`
- Upload:
  - `UPLOAD_MAX_IMAGE_SIZE_BYTES`
  - `UPLOAD_ALLOWED_IMAGE_MIME_TYPES`
- Storage:
  - `STORAGE_ROOT` (compatibilidade com público)
  - `STORAGE_PUBLIC_ROOT`
  - `STORAGE_PRIVATE_ROOT`
- Seed admin: `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- OpenAI: `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_MAX_TOKENS`, `OPENAI_TEMPERATURE`, `OPENAI_DAILY_LIMIT_DEFAULT`

## Headers no reverso (produção)

Sim: `CSP`, `HSTS`, `X-Frame-Options` e afins devem ser definidos no servidor reverso (Nginx/Caddy/Traefik).
No app já existe `helmet`, mas o reverso é o ponto ideal para padronizar e reforçar headers.

Exemplo (Nginx):

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; img-src 'self' data: https:; object-src 'none'; frame-ancestors 'none'; base-uri 'self';" always;
```

## Rotas (resumo)

Base padrão: `/api`

### Utilitárias

- `GET /health`
- `GET /api/csrf-token`

### Admin - autenticação

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/refresh`
- `GET /api/admin/auth/me`
- `POST /api/admin/auth/logout`
- `DELETE /api/admin/auth/account`

### Admin - conteúdo

- `GET /api/admin/posts`
- `POST /api/admin/posts`
- `GET /api/admin/posts/:id`
- `PUT /api/admin/posts/:id`
- `DELETE /api/admin/posts/:id`
- `POST /api/admin/posts/:id/generate`

### Admin - conversas/revisões/logs

- `GET /api/admin/posts/:id/conversations`
- `POST /api/admin/posts/:id/conversations`
- `GET /api/admin/posts/:id/conversations/:conversationId/messages`
- `POST /api/admin/posts/:id/conversations/:conversationId/messages`
- `GET /api/admin/posts/:id/revisions`
- `GET /api/admin/posts/:id/revisions/:revisionId`
- `GET /api/admin/posts/:id/generation-logs`

### Admin - configurações

- `GET /api/admin/instructions`
- `GET /api/admin/instructions/:id`
- `POST /api/admin/instructions`
- `PUT /api/admin/instructions/:id`
- `GET /api/admin/settings`
- `PUT /api/admin/settings`
- `GET /api/admin/profile`
- `POST /api/admin/profile`
- `POST /api/admin/uploads/images`
- `GET /api/admin/comments`
- `PATCH /api/admin/comments/:id`

### Público

- `GET /api/public/posts`
- `GET /api/public/posts/:year/:month/:slug`
- `GET /api/public/posts/:year/:month/:slug/engagement`
- `POST /api/public/posts/:year/:month/:slug/likes`
- `GET /api/public/posts/:year/:month/:slug/comments`
- `POST /api/public/posts/:year/:month/:slug/comments`
- `GET /api/public/settings?slug=<slug-do-autor>`
- `GET /api/public/stats/users`
- `GET /api/public/blogs/:slug`
- `GET /api/public/blogs/:slug/posts/:year/:month/:postSlug`
- `POST /api/public/register`

Para onboarding completo (frontend + backend), veja:
[README.md](../../README.md)
