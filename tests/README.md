# Testes — Loja Vera

## Comandos

| Comando | Descrição |
|--------|-----------|
| `npm test` (na **raiz**) | Roda testes de **backend** + **frontend** (Vitest). |
| `npm run test:backend` | Só API. |
| `npm run test:frontend` | Só React. |
| `npm run test:e2e` | Cypress (precisa Vite + API no ar). |

## Backend (`backend/tests/backend/`)

- **Vitest** + **Supertest** (equivalente moderno a Jest + Supertest, com ESM nativo).
- `setup.ts` carrega `.env` e opcionalmente `.env.test`.
- Testes que precisam de banco usam `describe.skipIf(!DATABASE_URL)` ou `skipIf(!hasDb)`.
- Para login integração: `docker compose up -d`, `npx prisma db push`, `npm run db:seed`.

## Frontend (`frontend/tests/frontend/`)

- **Vitest** + **Testing Library** + **jsdom**.
- Mocks de `api` onde necessário.

## E2E (`tests/e2e/`)

1. `docker compose up -d` (raiz)  
2. Terminal A: `cd backend && npm run dev`  
3. Terminal B: `cd frontend && npm run dev`  
4. Terminal C (raiz): `npm install && npm run test:e2e`

## Nota sobre “cliente / advogado”

O domínio do sistema é **aluguel de trajes** (admin, mobile, locações). Os cenários E2E e de permissão foram mapeados para **ADMIN vs MOBILE** e rotas protegidas.
