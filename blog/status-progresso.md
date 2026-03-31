# Diário de Progresso — Backblog

_Atualizado em: 2026-03-26_

## Resumo executivo

- Plataforma multiusuário ativa: cadastro público, login por sessão, perfil com slug e workspace por usuário.
- Fluxo editorial completo no admin: editor rico, upload de imagens, revisões, conversa com IA e publicação.
- Site público funcional em dois formatos:
  - arquivo global (`/posts/...`)
  - blog por autor (`/blog/{slug}` + permalink próprio)
- Engajamento em produção local: curtidas por fingerprint, comentários públicos e moderação no painel.
- Proteção CSRF implementada e aplicada nas rotas de escrita.
- RSS e PWA básicos ativos.

## Status por área

### Banco e backend (`blog/server`)

- `schema.sql` consolidado com tabelas para:
  - autenticação/sessão (`users`, `sessions`)
  - conteúdo (`posts`, `tags`, `post_tags`, `post_revisions`)
  - IA (`instructions`, `instruction_versions`, `conversations`, `conversation_messages`, `ai_generation_logs`)
  - público/engajamento (`post_likes`, `post_comments`, `blog_settings`, `user_profiles`, `user_workspaces`, `audit_logs`)
- Segurança ativa:
  - `helmet`, `compression`, `cors`
  - rate limit de login
  - cookies `httpOnly` + `sameSite=lax` (+ `secure` em produção)
  - CSRF com cookie + header (`GET /api/csrf-token`, validação de origem opcional)
- API admin entregue para:
  - auth (`login`, `refresh`, `me`, `logout`, `delete account`)
  - CRUD de posts, revisões e logs de geração
  - conversas por post
  - instruções de IA
  - configurações do blog
  - perfil/alinhamento do autor
  - upload de imagens
  - moderação de comentários
- API pública entregue para:
  - listagem/leitura de posts e blog por slug
  - cadastro (`/api/public/register`)
  - estatísticas públicas (`/api/public/stats/users`)
  - likes/comentários por permalink

### IA e conteúdo

- `aiService` integrado à OpenAI via modelo configurável em `.env` (padrão: `gpt-4o-mini`).
- Prompt combina instrução de sistema + instrução ativa + contexto do post/conversa.
- Saída normalizada para o perfil de Markdown do editor (`markdownProfile.json`).
- Conversas e gerações registradas em revisões e logs.

### Frontend admin (`blog/client`)

- Área protegida com `AuthProvider` + `ProtectedView`.
- Dashboard com atalhos para posts, moderação, aparência e alinhamento.
- Editor de post com:
  - Tiptap + upload de imagem (até 5MB, tipos validados)
  - salvar rascunho, publicar e excluir
  - revisões (carregar/aplicar)
  - chat com IA por conversa persistente
- Página de alinhamento da IA com formulário estruturado e persistência em perfil.
- Página de aparência com preview em tempo real.
- Moderação com filtros por status, busca e paginação incremental.

### Frontend público

- Landing com CTA, login/cadastro, termos/privacidade e contadores de usuários.
- Arquivo global:
  - `/posts`
  - `/posts/{ano}/{mes}`
  - `/posts/{ano}/{mes}/{slug}`
- Blog por autor:
  - `/blog/{slug}`
  - `/blog/{slug}/posts/{ano}/{mes}/{postSlug}`
- Conteúdo sanitizado antes de renderização.
- Painel de engajamento no post por autor: curtir, compartilhar, listar/enviar comentários.

### SEO, distribuição e PWA

- RSS ativo em `/rss.xml` (últimos 20 posts).
- Metadata/OG nas páginas públicas principais.
- Manifest em `app/manifest.ts` e arquivo estático em `public/manifest.json`.
- Service worker (`notification-sw.js`) com cache de assets estáticos (ativado em produção).

## Melhorias prioritárias

1. Criar suíte de testes automatizados (unit + integração) para auth, posts, IA e moderação.
2. Evoluir de `schema.sql` para migrações versionadas.
3. Adicionar observabilidade mínima: logs estruturados, métricas e alertas.
4. Completar SEO técnico com `sitemap.xml`, canonicals por rota e revisão de OG por contexto de autor.
5. Formalizar rotina de backup/restore com teste periódico de recuperação.
6. Revisar busca textual para aproveitar `search_vector`/FTS nas consultas (hoje predomina `ILIKE`).
7. Fortalecer estratégia offline do PWA para além de assets estáticos.

## Coerência com `requisitos.md`

- O requisito foi atualizado para o cenário multiusuário já implementado.
- O requisito agora reflete CSRF como funcionalidade entregue (não pendência).
- Mantidos como backlog explícito: testes automatizados, migrações versionadas, SEO técnico completo e observabilidade.
