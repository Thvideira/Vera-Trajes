# Loja Vera — Gestão de aluguel de trajes

Repositório no GitHub: **Vera-trajes**.

Backend: Node.js, Express, Prisma, PostgreSQL. Frontend: React, TypeScript, Vite, Tailwind.

---

## O que você precisa instalar

| Ferramenta | Para quê |
|------------|----------|
| **Node.js 20+** | Rodar backend e frontend ([nodejs.org](https://nodejs.org)) |
| **Docker Desktop** (recomendado) | Subir o PostgreSQL sem instalar o Postgres “na mão” |

Se você **já tem** PostgreSQL instalado (Postgres.app, Homebrew, etc.), pode pular o Docker e só ajustar a `DATABASE_URL` no `.env` do backend.

---

## Passo a passo (primeira vez)

Siga **na ordem**. Abra **dois terminais**: um para o backend, outro para o frontend.

### 1) Banco de dados PostgreSQL

**Opção A — com Docker (mais simples)**

Na **raiz** do projeto (pasta `Loja.Vera`):

```bash
docker compose up -d
```

Espere alguns segundos. O banco fica em `localhost` porta **5432**, usuário `lojavera`, senha `lojavera_dev`, database `loja_vera`.

Para ver se subiu:

```bash
docker compose ps
```

**Opção B — PostgreSQL que você já usa**

Crie um banco vazio (ex.: `loja_vera`) e anote usuário, senha, host e porta. Você vai montar a `DATABASE_URL` no passo 2.

---

### 2) Configurar o backend

```bash
cd backend
cp .env.example .env
```

- Se usou **Docker (Opção A)**, não precisa mudar nada no `.env` — a URL já bate com o `docker-compose.yml`.
- Se usou **Opção B**, edite `DATABASE_URL` no `.env` para o seu servidor (formato:  
  `postgresql://USUARIO:SENHA@HOST:PORTA/NOME_DO_BANCO?schema=public`).

Instale dependências e crie as tabelas no banco:

```bash
npm install
npx prisma generate
npx prisma db push
```

- `db push` aplica o schema do Prisma no PostgreSQL (ideal para desenvolvimento local).
- Se preferir usar migrations nomeadas depois, você pode usar `npx prisma migrate dev` em vez de `db push` (exige banco vazio e gera pasta `prisma/migrations`).

Crie o usuário admin de teste:

```bash
npm run db:seed
```

Suba a API:

```bash
npm run dev
```

Deve aparecer algo como: `API em http://localhost:4000`.

**Teste rápido:** no navegador ou no terminal:

```bash
curl http://localhost:4000/health
```

Resposta esperada: `{"ok":true}`.

---

### 3) Configurar o frontend

Em **outro terminal**:

```bash
cd frontend
npm install
npm run dev
```

O Vite mostrará um endereço (geralmente **http://localhost:5173**). Abra no navegador.

O frontend já está configurado para mandar `/api` e `/files` para o backend na porta **4000** (proxy no `vite.config.ts`). Com backend e frontend rodando, o app deve carregar o dashboard.

---

### 4) Login (opcional em desenvolvimento)

Com `AUTH_DISABLED=true` no `.env` do backend (padrão do exemplo), a API aceita chamadas **sem** token.

Se quiser testar login: usuário seed `admin@loja.vera` / senha `admin123` (após `npm run db:seed`).

---

## Parar o banco Docker

Na raiz do projeto:

```bash
docker compose down
```

Os dados ficam no volume Docker até você apagar o volume ou rodar `docker compose down -v`.

---

## Problemas comuns

| Sintoma | O que fazer |
|--------|--------------|
| `Can't reach database server` | Confira se o Postgres está rodando (`docker compose ps`) e se a `DATABASE_URL` no `backend/.env` está certa. |
| Porta **5432** já em uso | Outro Postgres está na mesma porta: pare o outro serviço ou mude a porta no `docker-compose.yml` (ex.: `"5433:5432"`) e ajuste a `DATABASE_URL` para `localhost:5433`. |
| Frontend em branco / erro de API | Backend precisa estar em **4000**; abra o terminal do backend e veja se há erro. |
| `prisma` pede confirmação | Em `db push`, confirme com **y** se perguntar sobre perda de dados (em banco novo, é seguro). |

---

## Estrutura útil

- `backend/.env` — variáveis secretas (não commitar). Use `.env.example` como modelo.
- `backend/prisma/schema.prisma` — modelos do banco.
- `frontend/vite.config.ts` — proxy para API e arquivos estáticos.

### Locação (retiradas e trajes)

O modelo atual separa **Locação** → **Retirada** (data própria) → **TrajeLocado** (status de preparação, ajustes e lavagem). Após puxar alterações do schema, rode no `backend`:

```bash
npx prisma generate
npx prisma db push
```

Em bancos de desenvolvimento isso recria as tabelas conforme o schema; **não use `db push` em produção sem backup** — prefira `prisma migrate`.

### WhatsApp e Cloudinary

Opcionais. Veja comentários no `backend/.env.example` e variáveis `WHATSAPP_*` e `CLOUDINARY_*`.
