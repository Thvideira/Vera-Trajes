-- Cancelamento de locação: status, auditoria, estorno em pagamentos

CREATE TYPE "LocacaoStatus" AS ENUM ('ATIVA', 'CANCELADA');

ALTER TABLE "locacoes" ADD COLUMN "status_locacao" "LocacaoStatus" NOT NULL DEFAULT 'ATIVA';
ALTER TABLE "locacoes" ADD COLUMN "cancelada_em" TIMESTAMP(3);
ALTER TABLE "locacoes" ADD COLUMN "cancelada_motivo" TEXT;
ALTER TABLE "locacoes" ADD COLUMN "cancelada_por_user_id" TEXT;

ALTER TABLE "pagamentos" ADD COLUMN "estornado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pagamentos" ADD COLUMN "estornado_em" TIMESTAMP(3);

ALTER TYPE "PagamentoLocacaoStatus" ADD VALUE 'CANCELADA';
ALTER TYPE "TipoPagamentoRegistro" ADD VALUE 'ESTORNO_CANCELAMENTO';
