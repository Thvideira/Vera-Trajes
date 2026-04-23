-- Rode UMA vez se o Prisma disser que migrações estão aplicadas no banco
-- mas faltam na pasta local (após unificar tudo em 20240101000000_init).
--
-- Ex.: npm run db:reconcile-history
--   ou: npx prisma db execute --file prisma/reconcile-migration-history.sql --schema prisma/schema.prisma
--
-- Depois: npx prisma migrate resolve --applied "20240101000000_init"
-- (só se a linha do init ainda não existir em _prisma_migrations)

DELETE FROM "_prisma_migrations"
WHERE "migration_name" IN (
  '20260222140000_locacao_cancelamento',
  '20260417140000_traje_locado_status_v2'
);
