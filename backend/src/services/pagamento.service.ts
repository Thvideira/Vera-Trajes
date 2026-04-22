import {
  PagamentoLocacaoStatus,
  TipoPagamentoRegistro,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";

function tipoEhEstorno(tipo: TipoPagamentoRegistro): boolean {
  return tipo === TipoPagamentoRegistro.ESTORNO_CANCELAMENTO;
}

const HISTORICO_LIMITE_PADRAO = 500;

/**
 * Situação típica da locação após o lançamento (sem coluna extra no banco).
 * FINAL implica quitação; PARCIAL implica saldo em aberto; SINAL usa o status atual da locação.
 */
function inferirSituacaoAposPagamento(
  tipo: TipoPagamentoRegistro,
  statusLocacaoAtual: PagamentoLocacaoStatus
): PagamentoLocacaoStatus {
  if (tipoEhEstorno(tipo)) return PagamentoLocacaoStatus.CANCELADA;
  if (tipo === TipoPagamentoRegistro.FINAL) return PagamentoLocacaoStatus.PAGO;
  if (tipo === TipoPagamentoRegistro.PARCIAL) {
    return PagamentoLocacaoStatus.PARCIAL;
  }
  return statusLocacaoAtual;
}

export async function listHistoricoPagamentos(limit = HISTORICO_LIMITE_PADRAO) {
  const rows = await prisma.pagamento.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      locacao: {
        select: {
          id: true,
          statusPagamento: true,
          cliente: { select: { nome: true } },
        },
      },
    },
  });

  return rows.map((r) => ({
    pagamentoId: r.id,
    dividaId: r.locacaoId,
    clienteNome: r.locacao.cliente.nome,
    valorPago: r.valor.toFixed(2),
    dataPagamento: r.createdAt.toISOString(),
    tipoRegistro: r.tipo,
    estornado: r.estornado,
    situacaoDividaAposPagamento: inferirSituacaoAposPagamento(
      r.tipo,
      r.locacao.statusPagamento
    ),
  }));
}
