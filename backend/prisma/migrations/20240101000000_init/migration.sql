-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TrajeTipo" AS ENUM ('VESTIDO', 'TERNO', 'SAPATO', 'DAMINHA', 'CALCA');

-- CreateEnum
CREATE TYPE "TrajeStatus" AS ENUM ('DISPONIVEL', 'ALUGADO');

-- CreateEnum
CREATE TYPE "RetiradaStatus" AS ENUM ('PENDENTE', 'PRONTO', 'RETIRADO');

-- CreateEnum
CREATE TYPE "TrajeLocadoStatus" AS ENUM ('COSTUREIRA', 'LAVANDO', 'FALTA_PASSAR', 'PRONTO', 'RETIRADO', 'DEVOLUCAO_FEITA');

-- CreateEnum
CREATE TYPE "LavagemStatus" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'FEITO');

-- CreateEnum
CREATE TYPE "AjusteTipo" AS ENUM ('BARRA', 'CINTURA', 'COMPRIMENTO', 'OUTROS');

-- CreateEnum
CREATE TYPE "AjusteStatus" AS ENUM ('PENDENTE', 'CONCLUIDO');

-- CreateEnum
CREATE TYPE "PagamentoLocacaoStatus" AS ENUM ('PENDENTE', 'PARCIAL', 'PAGO', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoPagamentoRegistro" AS ENUM ('SINAL', 'PARCIAL', 'FINAL', 'ESTORNO_CANCELAMENTO');

-- CreateEnum
CREATE TYPE "LocacaoStatus" AS ENUM ('ATIVA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "MovimentacaoTipo" AS ENUM ('SAIDA_ALUGUEL', 'ENTRADA_DEVOLUCAO');

-- CreateEnum
CREATE TYPE "NotificacaoTipo" AS ENUM ('CONFIRMACAO_ALUGUEL', 'LEMBRETE_RETIRADA', 'LEMBRETE_EVENTO', 'ATRASO_DEVOLUCAO', 'PAGAMENTO_PENDENTE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MOBILE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nome" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trajes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TrajeTipo" NOT NULL,
    "codigo" TEXT NOT NULL,
    "tamanho" TEXT NOT NULL,
    "status" "TrajeStatus" NOT NULL DEFAULT 'DISPONIVEL',
    "foto_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locacoes" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "data_aluguel" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacoes" TEXT,
    "data_evento" TIMESTAMP(3),
    "data_devolucao_prevista" TIMESTAMP(3),
    "encerrada" BOOLEAN NOT NULL DEFAULT false,
    "status_locacao" "LocacaoStatus" NOT NULL DEFAULT 'ATIVA',
    "cancelada_em" TIMESTAMP(3),
    "cancelada_motivo" TEXT,
    "cancelada_por_user_id" TEXT,
    "valor_total" DECIMAL(12,2) NOT NULL,
    "valor_pago" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status_pagamento" "PagamentoLocacaoStatus" NOT NULL DEFAULT 'PENDENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locacao_itens_descritivos" (
    "id" TEXT NOT NULL,
    "locacao_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "variacao" TEXT,
    "observacao" TEXT,
    "separado_entrega" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locacao_itens_descritivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retiradas" (
    "id" TEXT NOT NULL,
    "locacao_id" TEXT NOT NULL,
    "data_retirada" TIMESTAMP(3) NOT NULL,
    "status" "RetiradaStatus" NOT NULL DEFAULT 'PENDENTE',

    CONSTRAINT "retiradas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trajes_locados" (
    "id" TEXT NOT NULL,
    "retirada_id" TEXT NOT NULL,
    "traje_id" TEXT NOT NULL,
    "status" "TrajeLocadoStatus" NOT NULL DEFAULT 'PRONTO',
    "precisa_ajuste" BOOLEAN NOT NULL DEFAULT false,
    "precisa_lavagem" BOOLEAN NOT NULL DEFAULT true,
    "lavagem_status" "LavagemStatus" NOT NULL DEFAULT 'PENDENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trajes_locados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajustes" (
    "id" TEXT NOT NULL,
    "traje_locado_id" TEXT NOT NULL,
    "tipo" "AjusteTipo" NOT NULL,
    "descricao" TEXT,
    "status" "AjusteStatus" NOT NULL DEFAULT 'PENDENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ajustes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locacao_historico" (
    "id" TEXT NOT NULL,
    "locacao_id" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "detalhe" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locacao_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" TEXT NOT NULL,
    "locacao_id" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "tipo" "TipoPagamentoRegistro" NOT NULL,
    "estornado" BOOLEAN NOT NULL DEFAULT false,
    "estornado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacoes" (
    "id" TEXT NOT NULL,
    "traje_id" TEXT NOT NULL,
    "locacao_id" TEXT,
    "tipo" "MovimentacaoTipo" NOT NULL,
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacao_envios" (
    "id" TEXT NOT NULL,
    "locacao_id" TEXT NOT NULL,
    "tipo" "NotificacaoTipo" NOT NULL,
    "data_chave" DATE NOT NULL,
    "sucesso" BOOLEAN NOT NULL DEFAULT true,
    "detalhe_erro" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacao_envios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_cpf_key" ON "clientes"("cpf");

-- CreateIndex
CREATE INDEX "clientes_nome_idx" ON "clientes"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "trajes_codigo_key" ON "trajes"("codigo");

-- CreateIndex
CREATE INDEX "trajes_tipo_idx" ON "trajes"("tipo");

-- CreateIndex
CREATE INDEX "trajes_codigo_idx" ON "trajes"("codigo");

-- CreateIndex
CREATE INDEX "locacoes_data_aluguel_idx" ON "locacoes"("data_aluguel");

-- CreateIndex
CREATE INDEX "locacoes_encerrada_idx" ON "locacoes"("encerrada");

-- CreateIndex
CREATE INDEX "locacao_itens_descritivos_locacao_id_idx" ON "locacao_itens_descritivos"("locacao_id");

-- CreateIndex
CREATE INDEX "retiradas_locacao_id_idx" ON "retiradas"("locacao_id");

-- CreateIndex
CREATE INDEX "retiradas_data_retirada_idx" ON "retiradas"("data_retirada");

-- CreateIndex
CREATE INDEX "trajes_locados_traje_id_idx" ON "trajes_locados"("traje_id");

-- CreateIndex
CREATE INDEX "trajes_locados_status_idx" ON "trajes_locados"("status");

-- CreateIndex
CREATE UNIQUE INDEX "trajes_locados_retirada_id_traje_id_key" ON "trajes_locados"("retirada_id", "traje_id");

-- CreateIndex
CREATE INDEX "locacao_historico_locacao_id_idx" ON "locacao_historico"("locacao_id");

-- CreateIndex
CREATE INDEX "pagamentos_created_at_idx" ON "pagamentos"("created_at");

-- CreateIndex
CREATE INDEX "movimentacoes_traje_id_idx" ON "movimentacoes"("traje_id");

-- CreateIndex
CREATE INDEX "movimentacoes_created_at_idx" ON "movimentacoes"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notificacao_envios_locacao_id_tipo_data_chave_key" ON "notificacao_envios"("locacao_id", "tipo", "data_chave");

-- AddForeignKey
ALTER TABLE "locacoes" ADD CONSTRAINT "locacoes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locacao_itens_descritivos" ADD CONSTRAINT "locacao_itens_descritivos_locacao_id_fkey" FOREIGN KEY ("locacao_id") REFERENCES "locacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retiradas" ADD CONSTRAINT "retiradas_locacao_id_fkey" FOREIGN KEY ("locacao_id") REFERENCES "locacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trajes_locados" ADD CONSTRAINT "trajes_locados_retirada_id_fkey" FOREIGN KEY ("retirada_id") REFERENCES "retiradas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trajes_locados" ADD CONSTRAINT "trajes_locados_traje_id_fkey" FOREIGN KEY ("traje_id") REFERENCES "trajes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes" ADD CONSTRAINT "ajustes_traje_locado_id_fkey" FOREIGN KEY ("traje_locado_id") REFERENCES "trajes_locados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locacao_historico" ADD CONSTRAINT "locacao_historico_locacao_id_fkey" FOREIGN KEY ("locacao_id") REFERENCES "locacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_locacao_id_fkey" FOREIGN KEY ("locacao_id") REFERENCES "locacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_traje_id_fkey" FOREIGN KEY ("traje_id") REFERENCES "trajes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_locacao_id_fkey" FOREIGN KEY ("locacao_id") REFERENCES "locacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacao_envios" ADD CONSTRAINT "notificacao_envios_locacao_id_fkey" FOREIGN KEY ("locacao_id") REFERENCES "locacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
