## Backblog Client

Frontend Next.js do Backblog, responsável por área pública, autenticação e painel administrativo.

## Funcionalidades implementadas

- Área pública:
  - landing (`/`)
  - cadastro (`/signup`) com fluxo local por código de verificação e opção Google
  - login (`/login`) com opção local e Google
  - termos (`/termos`) e privacidade (`/privacidade`)
  - arquivo de posts (`/posts`, `/posts/{year}/{month}`, `/posts/{year}/{month}/{slug}`)
  - blog por autor (`/blog/{slug}`)
  - post por autor com engajamento (`/blog/{slug}/posts/{year}/{month}/{postSlug}`)
  - RSS (`/rss.xml`)
- Painel protegido (`/admin`):
  - dashboard
  - posts e editor Tiptap
  - conversas com IA por post
  - revisões
  - moderação de comentários
  - configurações visuais/SEO
  - alinhamento de IA por perfil

## Comportamento técnico

- `revalidate = 60` nas páginas públicas de arquivo/permalink global.
- Rotas de blog por autor usam renderização dinâmica (`force-dynamic`).
- O client faz bootstrap de CSRF automaticamente antes de chamadas `POST/PUT/PATCH/DELETE`.
- Service Worker é registrado somente em produção (`notification-sw.js`).

## Executando localmente

```bash
cd blog/client
cp .env.local.example .env.local
npm install
npm run dev
```

App padrão: `http://localhost:3000`

## Variáveis de ambiente

- `NEXT_PUBLIC_API_BASE_URL`: base da API (ex.: `http://localhost:4010/api`)
- `NEXT_PUBLIC_CSRF_COOKIE_NAME`: nome do cookie CSRF (default do backend: `backblog.csrf`)
- `NEXT_PUBLIC_APP_URL`: URL pública do frontend
- `NEXT_PUBLIC_CONTACT_EMAIL`: fallback de contato público
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: client id público do Google Sign-In

## Scripts

- `npm run dev`: desenvolvimento
- `npm run build`: build de produção
- `npm run start`: servidor de produção
- `npm run lint`: lint

Para setup completo (frontend + backend + banco), veja o README raiz:
[README.md](../../README.md)
