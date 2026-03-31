# Backblog

Backblog é uma plataforma fullstack de blog com área pública e painel administrativo, com foco em escrita assistida por IA, revisão contínua e publicação por autor.

## Stack

- Frontend: Next.js 15 + React + TypeScript + Tailwind
- Backend: Node.js + Express 5
- Banco: PostgreSQL
- IA: OpenAI API (`OPENAI_MODEL`, padrão `gpt-4o-mini`)

## Funcionalidades atuais

- Cadastro público (`/signup`) e autenticação por sessão com cookies (`login`, `refresh`, `logout`)
- Painel admin protegido (`/admin`) com:
  - criação/edição/publicação de posts
  - editor rico (Tiptap)
  - upload de imagens por workspace do usuário
  - histórico de revisões (humanas e IA)
  - conversa com IA por post (persistente)
  - alinhamento de perfil/voz de escrita
  - configuração visual/SEO do blog
  - moderação de comentários
- Área pública com:
  - landing, termos e privacidade
  - arquivo global de posts (`/posts`, `/posts/{ano}/{mes}`, permalink)
  - blog por autor (`/blog/{slug}` + permalink por autor)
  - curtidas e comentários (com moderação)
  - métricas públicas de usuários
- RSS em `/rss.xml`
- PWA básico (manifest + service worker)
- Proteção CSRF ativa na API (`/api/csrf-token` + header `X-CSRF-Token` em métodos de escrita)

## Estrutura

```text
blog/
  client/                 # Next.js (público + admin)
  server/                 # API Express + regras de negócio
  storage/                # uploads por workspace (runtime)
  requisitos.md
  status-progresso.md
```

## Setup rápido

### 1) Pré-requisitos

- Node.js 20+
- npm 10+
- PostgreSQL 14+

### 2) Variáveis de ambiente

```bash
cp blog/.env.example blog/.env
cp blog/client/.env.local.example blog/client/.env.local
```

Preencha principalmente `PG*`, `ADMIN_*` e `OPENAI_API_KEY` em `blog/.env`.

### 3) Banco de dados

```bash
psql -U <seu_usuario> -d backblog -f blog/server/schema.sql
node blog/server/seeds/initialSeed.js
```

### 4) Rodar backend

```bash
cd blog/server
npm install
npm run dev
```

API padrão: `http://localhost:4010`

### 5) Rodar frontend

```bash
cd blog/client
npm install
npm run dev
```

App padrão: `http://localhost:3000`

## Variáveis de ambiente

- Backend: [blog/.env.example](blog/.env.example)
- Frontend: [blog/client/.env.local.example](blog/client/.env.local.example)

## Documentação por módulo

- Frontend: [blog/client/README.md](blog/client/README.md)
- Backend/API: [blog/server/README.md](blog/server/README.md)
- Requisitos funcionais: [blog/requisitos.md](blog/requisitos.md)
- Status de entrega: [blog/status-progresso.md](blog/status-progresso.md)

## Segurança para publicar no GitHub

- Não commitar `blog/.env` e `blog/client/.env.local`.
- Não usar `NEXT_PUBLIC_*` para secrets.
- Se uma chave real foi usada localmente, rotacione antes de publicar.
