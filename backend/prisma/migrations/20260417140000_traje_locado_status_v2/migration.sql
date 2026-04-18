-- Traje locado: novo enum de status + coluna precisa_ajuste + migração de dados legados

ALTER TABLE "trajes_locados" ADD COLUMN IF NOT EXISTS "precisa_ajuste" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "TrajeLocadoStatus_new" AS ENUM (
  'COSTUREIRA',
  'LAVANDO',
  'FALTA_PASSAR',
  'PRONTO',
  'RETIRADO',
  'DEVOLUCAO_FEITA'
);

ALTER TABLE "trajes_locados" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "trajes_locados" ALTER COLUMN "status" TYPE "TrajeLocadoStatus_new" USING (
  CASE "status"::text
    WHEN 'AGUARDANDO_AJUSTE' THEN 'PRONTO'::"TrajeLocadoStatus_new"
    WHEN 'EM_AJUSTE' THEN 'COSTUREIRA'::"TrajeLocadoStatus_new"
    WHEN 'AJUSTADO' THEN 'LAVANDO'::"TrajeLocadoStatus_new"
    WHEN 'LAVAGEM_PENDENTE' THEN 'LAVANDO'::"TrajeLocadoStatus_new"
    WHEN 'EM_LAVAGEM' THEN 'LAVANDO'::"TrajeLocadoStatus_new"
    WHEN 'PRONTO_RETIRADA' THEN 'PRONTO'::"TrajeLocadoStatus_new"
    WHEN 'RETIRADO' THEN 'RETIRADO'::"TrajeLocadoStatus_new"
    WHEN 'FINALIZADO' THEN 'DEVOLUCAO_FEITA'::"TrajeLocadoStatus_new"
    ELSE 'PRONTO'::"TrajeLocadoStatus_new"
  END
);

DROP TYPE "TrajeLocadoStatus";

ALTER TYPE "TrajeLocadoStatus_new" RENAME TO "TrajeLocadoStatus";

ALTER TABLE "trajes_locados" ALTER COLUMN "status" SET DEFAULT 'PRONTO'::"TrajeLocadoStatus";

UPDATE "trajes_locados" tl
SET "precisa_ajuste" = EXISTS (
  SELECT 1
  FROM "ajustes" a
  WHERE a."traje_locado_id" = tl."id"
    AND a."status" = 'PENDENTE'
);
