# Especificação Funcional — Backblog (versão atual)

_Atualizado em: 2026-03-26_

## 1) Escopo

Backblog é um CMS/blog multiusuário com:

- painel administrativo autenticado para produção de conteúdo;
- assistente de escrita com IA (geração + conversa por contexto);
- publicação pública em arquivo global e em blog por autor;
- engajamento público (curtidas e comentários com moderação).

Não há módulo de pagamentos.

## 2) Objetivos do produto

- Permitir que cada usuário escreva e publique com identidade própria.
- Reduzir fricção editorial com IA sem perder controle humano.
- Entregar leitura pública com URLs limpas, metadata e RSS.
- Manter baseline de segurança para operação web pública.

## 3) Requisitos funcionais

### 3.1 Autenticação e conta

- Cadastro público com `name`, `email`, `password`, `confirmPassword` e aceite de termos.
- Login por email e senha.
- Sessão com cookie `httpOnly` + refresh token.
- Endpoint para `me` (usuário autenticado).
- Logout e exclusão da conta (com remoção de dados do usuário).
- Limite de tentativas no login (rate limit).

### 3.2 Perfil do autor e identidade

- Perfil por usuário com:
  - `displayName`
  - `slug` público
  - `shortDescription`
  - `alignment` (blocos de alinhamento para IA)
- Slug é usado para rota pública `/blog/{slug}`.

### 3.3 Posts (admin)

- Criar post rascunho.
- Editar título, conteúdo, status, tags, data de publicação e tempo de leitura.
- Publicar/despublicar via atualização de status.
- Excluir post.
- Manter revisões (`human` e `ai`).
- Listar posts com filtros por status, data, tag e busca textual.

### 3.4 Editor e mídia

- Editor rico (Tiptap) no admin.
- Upload de imagem com validação de tipo (`jpg/png/webp/gif`) e tamanho (5MB).
- Armazenamento de arquivos por workspace do usuário.

### 3.5 IA editorial

- Geração de revisão por IA a partir de rascunho e instrução ativa.
- Conversas persistentes por post (mensagens user/ai/system).
- Registro de logs de geração (modelo, tokens, latência, status).
- Normalização de markdown conforme `markdownProfile.json`.

### 3.6 Configurações do blog

- Gestão de nome do blog, tagline e descrição SEO.
- Gestão de tema visual (cores base e paleta para blocos de código).
- Gestão de texto “sobre”, contato e links sociais.

### 3.7 Público

- Landing pública (`/`) com CTA.
- Arquivo global:
  - `/posts`
  - `/posts/{year}/{month}`
  - `/posts/{year}/{month}/{slug}`
- Blog por autor:
  - `/blog/{slug}`
  - `/blog/{slug}/posts/{year}/{month}/{postSlug}`
- RSS com últimos 20 posts em `/rss.xml`.

### 3.8 Engajamento e moderação

- Curtidas por fingerprint por post.
- Comentários públicos por post com status inicial `pending`.
- Moderação no admin (`pending`, `approved`, `hidden`).
- Exibição pública apenas de comentários aprovados.

## 4) Requisitos não funcionais

### 4.1 Segurança

- Hash de senha com Argon2.
- Cookies de sessão com `httpOnly` e `sameSite=lax`.
- CSRF em rotas de escrita (`/api/admin/*` e `/api/public/*`) com token em header.
- CORS configurável por ambiente.
- Sanitização do HTML no frontend público antes de renderizar conteúdo.

### 4.2 Performance e entrega

- Compressão HTTP no backend.
- Revalidação de páginas públicas de arquivo/permalink global em 60s.
- Service worker com cache básico de assets estáticos (produção).

### 4.3 Banco de dados

- PostgreSQL como banco principal.
- `schema.sql` único com criação e alterações idempotentes.
- Índices para arquivo de posts, tags, buscas e engajamento.

## 5) Contrato de API (estado atual)

### 5.1 Utilitários

- `GET /health`
- `GET /api/csrf-token`

### 5.2 Admin auth

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/refresh`
- `GET /api/admin/auth/me`
- `POST /api/admin/auth/logout`
- `DELETE /api/admin/auth/account`

### 5.3 Admin conteúdo

- `GET /api/admin/posts`
- `POST /api/admin/posts`
- `GET /api/admin/posts/:id`
- `PUT /api/admin/posts/:id`
- `DELETE /api/admin/posts/:id`
- `POST /api/admin/posts/:id/generate`

### 5.4 Admin IA/revisões

- `GET /api/admin/posts/:id/conversations`
- `POST /api/admin/posts/:id/conversations`
- `GET /api/admin/posts/:id/conversations/:conversationId/messages`
- `POST /api/admin/posts/:id/conversations/:conversationId/messages`
- `GET /api/admin/posts/:id/revisions`
- `GET /api/admin/posts/:id/revisions/:revisionId`
- `GET /api/admin/posts/:id/generation-logs`

### 5.5 Admin configuração

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

### 5.6 Público

- `GET /api/public/posts`
- `GET /api/public/posts/:year/:month/:slug`
- `GET /api/public/posts/:year/:month/:slug/engagement`
- `POST /api/public/posts/:year/:month/:slug/likes`
- `GET /api/public/posts/:year/:month/:slug/comments`
- `POST /api/public/posts/:year/:month/:slug/comments`
- `GET /api/public/settings`
- `GET /api/public/stats/users`
- `GET /api/public/blogs/:slug`
- `POST /api/public/register`

## 6) Requisitos de dados (alto nível)

Entidades principais já presentes no schema:

- `users`, `sessions`, `user_workspaces`
- `user_profiles`, `blog_settings`
- `instructions`, `instruction_versions`
- `posts`, `tags`, `post_tags`, `post_revisions`
- `conversations`, `conversation_messages`, `ai_generation_logs`
- `post_likes`, `post_comments`
- `audit_logs`

## 7) Backlog oficial (próximas entregas)

1. Testes automatizados (unit + integração).
2. Migrações versionadas (substituir estratégia centrada em `schema.sql`).
3. Observabilidade (logs estruturados, métricas, alertas).
4. SEO técnico completo (`sitemap.xml`, canonicals revisados por contexto).
5. Rotina formal de backup/restore com teste periódico.
6. Evolução da busca para usar FTS (`search_vector`) no runtime.
