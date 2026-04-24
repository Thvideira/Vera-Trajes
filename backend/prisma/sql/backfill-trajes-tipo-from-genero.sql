-- Uso: alinhar banco que ficou com coluna `genero` ao schema 3.0 (coluna `tipo` TrajeTipo).
-- Rode a partir da pasta backend:
--   npx prisma db execute --file prisma/sql/backfill-trajes-tipo-from-genero.sql --schema prisma/schema.prisma
--
-- Depois: npx prisma db push && npm run db:seed (se precisar)

DO $mig$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trajes' AND column_name = 'tipo'
  ) THEN
    RAISE NOTICE 'Coluna trajes.tipo já existe — pulando.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trajes' AND column_name = 'genero'
  ) THEN
    RAISE EXCEPTION 'Não há coluna genero em trajes; este script não se aplica. Use prisma db push ou revise o banco.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TrajeTipo') THEN
    CREATE TYPE "TrajeTipo" AS ENUM ('VESTIDO', 'TERNO', 'SAPATO', 'DAMINHA', 'CALCA');
  END IF;

  ALTER TABLE "trajes" ADD COLUMN "tipo" "TrajeTipo";

  UPDATE "trajes" SET "tipo" = (
    CASE lower(trim("genero"::text))
      WHEN 'vestido' THEN 'VESTIDO'
      WHEN 'terno' THEN 'TERNO'
      WHEN 'calca' THEN 'CALCA'
      WHEN 'calça' THEN 'CALCA'
      WHEN 'sapatos' THEN 'SAPATO'
      WHEN 'sapato' THEN 'SAPATO'
      WHEN 'daminha' THEN 'DAMINHA'
      ELSE 'VESTIDO'
    END
  )::"TrajeTipo";

  ALTER TABLE "trajes" ALTER COLUMN "tipo" SET NOT NULL;

  DROP INDEX IF EXISTS "trajes_codigo_genero_key";
  DROP INDEX IF EXISTS "trajes_genero_idx";

  ALTER TABLE "trajes" DROP COLUMN "genero";

  DROP TYPE IF EXISTS "GeneroTraje";

  -- Índice único só em codigo (estado 3.0)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'trajes' AND indexname = 'trajes_codigo_key'
  ) THEN
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY LOWER(TRIM(codigo))
          ORDER BY "created_at", id
        ) AS rn
      FROM "trajes"
    )
    UPDATE "trajes" t
    SET codigo = TRIM(t.codigo) || '-' || SUBSTRING(REPLACE(t.id::text, '-', ''), 1, 8)
    FROM ranked r
    WHERE t.id = r.id AND r.rn > 1;

    DROP INDEX IF EXISTS "trajes_codigo_idx";
    CREATE UNIQUE INDEX "trajes_codigo_key" ON "trajes"("codigo");
  END IF;

  CREATE INDEX IF NOT EXISTS "trajes_tipo_idx" ON "trajes"("tipo");
END $mig$;
