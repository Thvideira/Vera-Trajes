import { AjusteStatus, LavagemStatus, TrajeLocadoStatus, TrajeStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { computeRemaining } from "./finance.service.js";

/** Retirada nos próximos 2 dias (hoje + amanhã), fim do dia em São Paulo */
function rangeRetiradaProxima(): { gte: Date; lte: Date } {
  const now = new Date();
  const start = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(23, 59, 59, 999);
  return { gte: start, lte: end };
}

export async function getDashboard() {
  const hoje = new Date();
  const em7 = new Date(hoje);
  em7.setDate(em7.getDate() + 7);
  const { gte: inicioProx, lte: fimProx } = rangeRetiradaProxima();

  const prontos = [
    TrajeLocadoStatus.PRONTO_RETIRADA,
    TrajeLocadoStatus.RETIRADO,
    TrajeLocadoStatus.FINALIZADO,
  ];

  const [
    disponiveis,
    alugados,
    ajustesPendentes,
    locacoesProximas,
    locacoesAberto,
    alertasInteligentes,
  ] = await Promise.all([
    prisma.traje.count({ where: { status: TrajeStatus.DISPONIVEL } }),
    prisma.traje.count({ where: { status: TrajeStatus.ALUGADO } }),
    prisma.ajuste.count({ where: { status: AjusteStatus.PENDENTE } }),
    prisma.locacao.findMany({
      where: {
        encerrada: false,
        retiradas: {
          some: {
            dataRetirada: { lte: em7, gte: hoje },
          },
        },
      },
      include: {
        cliente: true,
        retiradas: {
          where: { dataRetirada: { lte: em7, gte: hoje } },
          include: { trajesLocados: { include: { traje: true } } },
          orderBy: { dataRetirada: "asc" },
        },
      },
      orderBy: { dataAluguel: "desc" },
      take: 10,
    }),
    prisma.locacao.findMany({
      where: { encerrada: false },
      include: {
        cliente: true,
        retiradas: {
          include: { trajesLocados: { include: { traje: true } } },
        },
      },
    }),
    prisma.trajeLocado.findMany({
      where: {
        retirada: {
          dataRetirada: { gte: inicioProx, lte: fimProx },
          locacao: { encerrada: false },
        },
        status: { notIn: prontos },
        OR: [
          { ajustes: { some: { status: AjusteStatus.PENDENTE } } },
          {
            AND: [
              { precisaLavagem: true },
              { lavagemStatus: { not: LavagemStatus.FEITO } },
            ],
          },
        ],
      },
      include: {
        traje: true,
        retirada: {
          include: {
            locacao: { include: { cliente: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);

  let valoresAReceber = 0;
  for (const l of locacoesAberto) {
    const r = computeRemaining(l.valorTotal, l.valorPago);
    valoresAReceber += Number(r.toFixed(2));
  }

  return {
    trajesDisponiveis: disponiveis,
    trajesAlugados: alugados,
    ajustesPendentes,
    locacoesProximas,
    valoresAReceber,
    alertasInteligentes: alertasInteligentes.map((a) => ({
      id: a.id,
      status: a.status,
      clienteNome: a.retirada.locacao.cliente.nome,
      trajeNome: a.traje.nome,
      trajeCodigo: a.traje.codigo,
      trajeFotoUrl: a.traje.fotoUrl,
      dataRetirada: a.retirada.dataRetirada,
      precisaLavagem: a.precisaLavagem,
      lavagemStatus: a.lavagemStatus,
    })),
  };
}
