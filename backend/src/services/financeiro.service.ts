import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { resumoAcessoriosLocacao } from "../utils/locacaoResponse.js";
import { computeRemaining } from "./finance.service.js";

/**
 * Detalhe da locação para o módulo financeiro (pendências e cobrança).
 */
export async function getFinanceiroLocacaoDetalhe(locacaoId: string) {
  const loc = await prisma.locacao.findUnique({
    where: { id: locacaoId },
    include: {
      cliente: { select: { nome: true, telefone: true } },
      itensDescritivos: { orderBy: { ordem: "asc" } },
      retiradas: {
        orderBy: { dataRetirada: "asc" },
        include: {
          trajesLocados: {
            include: {
              traje: { select: { nome: true, codigo: true, fotoUrl: true } },
            },
          },
        },
      },
    },
  });
  if (!loc) throw new AppError(404, "Locação não encontrada");

  const restante = computeRemaining(loc.valorTotal, loc.valorPago);

  return {
    locacao: {
      id: loc.id,
      encerrada: loc.encerrada,
      statusLocacao: loc.statusLocacao,
      canceladaEm: loc.canceladaEm,
      canceladaMotivo: loc.canceladaMotivo,
      statusPagamento: loc.statusPagamento,
      valorTotal: loc.valorTotal.toString(),
      valorPago: loc.valorPago.toString(),
      valorRestante: restante.toFixed(2),
      dataEvento: loc.dataEvento,
      dataAluguel: loc.dataAluguel,
      dataDevolucaoPrevista: loc.dataDevolucaoPrevista,
      observacoes: loc.observacoes,
    },
    cliente: loc.cliente,
    retiradas: loc.retiradas.map((r) => ({
      id: r.id,
      dataRetirada: r.dataRetirada,
      status: r.status,
      trajes: r.trajesLocados.map((tl) => ({
        trajeLocadoId: tl.id,
        nome: tl.traje.nome,
        codigo: tl.traje.codigo,
        fotoUrl: tl.traje.fotoUrl,
        status: tl.status,
        precisaAjuste: tl.precisaAjuste,
        precisaLavagem: tl.precisaLavagem,
        lavagemStatus: tl.lavagemStatus,
      })),
    })),
    itensDescritivos: loc.itensDescritivos.map((i) => ({
      id: i.id,
      descricao: i.descricao,
      quantidade: i.quantidade,
      variacao: i.variacao,
      observacao: i.observacao,
      separado: i.separado,
    })),
    acessorios: loc.itensDescritivos.map((i) => ({
      id: i.id,
      nome: i.descricao,
      quantidade: i.quantidade,
      variacao: i.variacao,
      observacao: i.observacao,
      separado: i.separado,
    })),
    resumoAcessorios: resumoAcessoriosLocacao(loc.itensDescritivos),
  };
}
