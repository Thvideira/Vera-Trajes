import {
  AjusteStatus,
  AjusteTipo,
  LavagemStatus,
  MovimentacaoTipo,
  PagamentoLocacaoStatus,
  Prisma,
  RetiradaStatus,
  TipoPagamentoRegistro,
  TrajeLocadoStatus,
  TrajeStatus,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { computeRemaining, derivePaymentStatus } from "./finance.service.js";
import { registrarHistorico } from "./locacaoHistorico.service.js";
import { sendConfirmacaoAluguel } from "./notificacao.service.js";
import {
  assertPodeMarcarProntoManual,
  recomputeTrajeLocado,
  syncRetiradaStatus,
} from "./trajeLocadoWorkflow.service.js";
import { weekendRangeUtcFromEventDate } from "../utils/weekendRange.js";

export interface RetiradaInput {
  dataRetirada: Date;
  trajes: {
    trajeId: string;
    precisaLavagem?: boolean;
    ajustes?: { tipo: AjusteTipo; descricao?: string }[];
  }[];
}

/** Payload bruto da API (retiradas vazias são filtradas em `filtrarRetiradasValidas`) */
export interface RetiradaCreateRaw {
  dataRetirada?: unknown;
  trajes?: {
    trajeId?: string;
    precisaLavagem?: boolean;
    ajustes?: { tipo: AjusteTipo; descricao?: string }[];
  }[];
}

export interface CreateLocacaoInput {
  clienteId: string;
  observacoes?: string | null;
  dataEvento?: Date | null;
  dataDevolucaoPrevista?: Date | null;
  valorTotal: Prisma.Decimal | string | number;
  valorPagoInicial?: Prisma.Decimal | string | number;
  retiradas: RetiradaCreateRaw[];
}

function parseDataRetirada(v: unknown): Date | null {
  if (v === undefined || v === null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Descarta retiradas sem data válida ou sem traje; dentro de cada retirada, ignora trajes sem id */
export function filtrarRetiradasValidas(
  raw: {
    dataRetirada?: unknown;
    trajes?: {
      trajeId?: string;
      precisaLavagem?: boolean;
      ajustes?: { tipo: AjusteTipo; descricao?: string }[];
    }[];
  }[]
): RetiradaInput[] {
  const out: RetiradaInput[] = [];
  for (const r of raw) {
    const dr = parseDataRetirada(r.dataRetirada);
    if (!dr) continue;
    const trajes = (r.trajes ?? [])
      .map((t) => ({
        trajeId: (t.trajeId ?? "").trim(),
        precisaLavagem: t.precisaLavagem,
        ajustes: t.ajustes,
      }))
      .filter((t) => t.trajeId.length > 0)
      .map((t) => ({
        trajeId: t.trajeId,
        precisaLavagem: t.precisaLavagem,
        ajustes: t.ajustes,
      }));
    if (trajes.length === 0) continue;
    out.push({ dataRetirada: dr, trajes });
  }
  return out;
}

function coletarTrajeIds(retiradas: RetiradaInput[]): string[] {
  const ids: string[] = [];
  for (const r of retiradas) {
    for (const t of r.trajes) ids.push(t.trajeId);
  }
  return ids;
}

async function assertTrajeLivreNaLocacao(
  locacaoId: string,
  trajeId: string,
  excludeTrajeLocadoId?: string
): Promise<void> {
  const existing = await prisma.trajeLocado.findFirst({
    where: {
      trajeId,
      retirada: { locacaoId },
      ...(excludeTrajeLocadoId
        ? { NOT: { id: excludeTrajeLocadoId } }
        : {}),
    },
  });
  if (existing) {
    throw new AppError(400, "Este traje já está nesta locação em outra retirada");
  }
}

/** Não permite o mesmo traje em duas locações abertas com evento no mesmo fim de semana (sáb–dom). */
async function assertTrajesSemConflitoMesmoFimDeSemana(
  trajeIds: string[],
  dataEvento: Date | null | undefined,
  excludeLocacaoId?: string
): Promise<void> {
  if (!dataEvento) return;
  const unique = [...new Set(trajeIds)];
  const { gte, lte } = weekendRangeUtcFromEventDate(dataEvento);

  for (const trajeId of unique) {
    const conflict = await prisma.trajeLocado.findFirst({
      where: {
        trajeId,
        retirada: {
          locacao: {
            encerrada: false,
            dataEvento: { not: null, gte, lte },
            ...(excludeLocacaoId ? { NOT: { id: excludeLocacaoId } } : {}),
          },
        },
      },
      include: { traje: { select: { codigo: true, nome: true } } },
    });
    if (conflict) {
      throw new AppError(
        400,
        `O traje ${conflict.traje.codigo} (${conflict.traje.nome}) já está em outra locação aberta cujo evento é no mesmo final de semana`
      );
    }
  }
}

function coletarTrajeIdsDaLocacao(loc: {
  retiradas: { trajesLocados: { trajeId: string }[] }[];
}): string[] {
  const ids: string[] = [];
  for (const r of loc.retiradas) {
    for (const tl of r.trajesLocados) ids.push(tl.trajeId);
  }
  return [...new Set(ids)];
}

export async function createLocacao(input: CreateLocacaoInput) {
  const retiradasValidas = filtrarRetiradasValidas(input.retiradas);
  if (!retiradasValidas.length) {
    throw new AppError(
      400,
      "Inclua ao menos uma retirada válida: data de retirada e ao menos um traje em cada retirada usada"
    );
  }

  const inputComRetiradas: CreateLocacaoInput = {
    ...input,
    retiradas: retiradasValidas,
  };

  const allTrajes = coletarTrajeIds(retiradasValidas);
  if (!allTrajes.length) {
    throw new AppError(400, "Inclua ao menos um traje nas retiradas");
  }
  if (new Set(allTrajes).size !== allTrajes.length) {
    throw new AppError(400, "Traje duplicado na mesma locação");
  }

  await assertTrajesSemConflitoMesmoFimDeSemana(
    allTrajes,
    input.dataEvento ?? null,
    undefined
  );

  const valorTotal = new Prisma.Decimal(input.valorTotal);
  const valorPagoInicial = new Prisma.Decimal(input.valorPagoInicial ?? 0);
  if (valorTotal.lt(0) || valorPagoInicial.lt(0)) {
    throw new AppError(400, "Valores inválidos");
  }
  if (valorPagoInicial.gt(valorTotal)) {
    throw new AppError(400, "Valor pago não pode exceder o total");
  }

  const locacao = await prisma.$transaction(async (tx) => {
    const trajesDb = await tx.traje.findMany({ where: { id: { in: allTrajes } } });
    if (trajesDb.length !== allTrajes.length) {
      throw new AppError(400, "Traje não encontrado");
    }
    for (const t of trajesDb) {
      if (t.status !== TrajeStatus.DISPONIVEL) {
        throw new AppError(400, `Traje ${t.codigo} não está disponível`);
      }
    }

    const statusPagamento = derivePaymentStatus(valorTotal, valorPagoInicial);

    const loc = await tx.locacao.create({
      data: {
        clienteId: inputComRetiradas.clienteId,
        observacoes: inputComRetiradas.observacoes ?? null,
        dataEvento: inputComRetiradas.dataEvento ?? null,
        dataDevolucaoPrevista: inputComRetiradas.dataDevolucaoPrevista ?? null,
        valorTotal,
        valorPago: valorPagoInicial,
        statusPagamento,
        retiradas: {
          create: retiradasValidas.map((r) => ({
            dataRetirada: r.dataRetirada,
            status: RetiradaStatus.PENDENTE,
            trajesLocados: {
              create: r.trajes.map((row) => ({
                trajeId: row.trajeId,
                precisaLavagem: row.precisaLavagem ?? true,
                lavagemStatus: LavagemStatus.PENDENTE,
                status: TrajeLocadoStatus.AGUARDANDO_AJUSTE,
                ajustes:
                  row.ajustes && row.ajustes.length > 0
                    ? {
                        create: row.ajustes.map((a) => ({
                          tipo: a.tipo,
                          descricao: a.descricao ?? null,
                          status: AjusteStatus.PENDENTE,
                        })),
                      }
                    : undefined,
              })),
            },
          })),
        },
      },
      include: {
        retiradas: {
          include: { trajesLocados: { include: { traje: true, ajustes: true } } },
        },
        cliente: true,
      },
    });

    await tx.traje.updateMany({
      where: { id: { in: allTrajes } },
      data: { status: TrajeStatus.ALUGADO },
    });

    for (const tid of allTrajes) {
      await tx.movimentacao.create({
        data: {
          trajeId: tid,
          locacaoId: loc.id,
          tipo: MovimentacaoTipo.SAIDA_ALUGUEL,
          observacao: "Saída por locação",
        },
      });
    }

    if (valorPagoInicial.gt(0)) {
      await tx.pagamento.create({
        data: {
          locacaoId: loc.id,
          valor: valorPagoInicial,
          tipo: TipoPagamentoRegistro.SINAL,
        },
      });
    }

    for (const ret of loc.retiradas) {
      for (const tl of ret.trajesLocados) {
        await recomputeTrajeLocado(tx, tl.id);
      }
      await syncRetiradaStatus(tx, ret.id);
    }

    await tx.locacaoHistorico.create({
      data: {
        locacaoId: loc.id,
        acao: "Locação criada",
        detalhe: {
          retiradasSalvas: retiradasValidas.length,
          trajes: allTrajes.length,
        },
      },
    });

    return loc;
  });

  void sendConfirmacaoAluguel(locacao.id);
  return getLocacao(locacao.id);
}

/** Limites UTC do dia YYYY-MM-DD (comparar com dataEvento gravada no banco) */
function utcDayRangeFromYmd(ymd: string): { gte: Date; lte: Date } {
  const [y, m, d] = ymd.split("-").map(Number);
  return {
    gte: new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)),
    lte: new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)),
  };
}

export async function listLocacoes(filters: {
  encerrada?: boolean;
  dataInicio?: Date;
  dataFim?: Date;
  /** YYYY-MM-DD — filtra pela data do evento da locação (não pela retirada) */
  dataEvento?: string;
}) {
  const enc =
    filters.encerrada === undefined ? undefined : filters.encerrada;

  const where: Prisma.LocacaoWhereInput = {};
  if (enc !== undefined) where.encerrada = enc;
  if (filters.dataEvento && /^\d{4}-\d{2}-\d{2}$/.test(filters.dataEvento)) {
    const { gte, lte } = utcDayRangeFromYmd(filters.dataEvento);
    where.dataEvento = { gte, lte };
  }

  const rows = await prisma.locacao.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    include: {
      cliente: true,
      retiradas: {
        include: {
          trajesLocados: {
            include: { traje: true, ajustes: true },
          },
        },
        orderBy: { dataRetirada: "asc" },
      },
      pagamentos: true,
    },
    orderBy: { dataAluguel: "desc" },
  });

  if (!filters.dataInicio && !filters.dataFim) return rows;

  return rows.filter((loc) =>
    loc.retiradas.some((r) => {
      const d = r.dataRetirada;
      if (filters.dataInicio && d < filters.dataInicio) return false;
      if (filters.dataFim && d > filters.dataFim) return false;
      return true;
    })
  );
}

export async function getLocacao(id: string) {
  const l = await prisma.locacao.findUnique({
    where: { id },
    include: {
      cliente: true,
      retiradas: {
        orderBy: { dataRetirada: "asc" },
        include: {
          trajesLocados: {
            include: { traje: true, ajustes: true },
          },
        },
      },
      pagamentos: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!l) throw new AppError(404, "Locação não encontrada");
  return l;
}

export async function listHistorico(locacaoId: string) {
  await getLocacao(locacaoId);
  return prisma.locacaoHistorico.findMany({
    where: { locacaoId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function patchLocacao(
  id: string,
  data: {
    observacoes?: string | null;
    dataEvento?: Date | null;
    dataDevolucaoPrevista?: Date | null;
  }
) {
  const antes = await getLocacao(id);
  if (data.dataEvento !== undefined && data.dataEvento !== null) {
    await assertTrajesSemConflitoMesmoFimDeSemana(
      coletarTrajeIdsDaLocacao(antes),
      data.dataEvento,
      id
    );
  }
  const loc = await prisma.locacao.update({
    where: { id },
    data: {
      ...(data.observacoes !== undefined ? { observacoes: data.observacoes } : {}),
      ...(data.dataEvento !== undefined ? { dataEvento: data.dataEvento } : {}),
      ...(data.dataDevolucaoPrevista !== undefined
        ? { dataDevolucaoPrevista: data.dataDevolucaoPrevista }
        : {}),
    },
    include: {
      cliente: true,
      retiradas: {
        include: { trajesLocados: { include: { traje: true, ajustes: true } } },
      },
    },
  });
  await registrarHistorico(id, "Locação atualizada", {
    antes: {
      observacoes: antes.observacoes,
      dataEvento: antes.dataEvento,
      dataDevolucaoPrevista: antes.dataDevolucaoPrevista,
    },
    depois: {
      observacoes: loc.observacoes,
      dataEvento: loc.dataEvento,
      dataDevolucaoPrevista: loc.dataDevolucaoPrevista,
    },
  });
  return loc;
}

export async function addRetirada(locacaoId: string, input: RetiradaInput) {
  const locacao = await getLocacao(locacaoId);
  if (!input.trajes.length) throw new AppError(400, "Retirada sem trajes");

  for (const t of input.trajes) {
    await assertTrajeLivreNaLocacao(locacaoId, t.trajeId);
  }

  const trajeIds = input.trajes.map((t) => t.trajeId);
  await assertTrajesSemConflitoMesmoFimDeSemana(
    trajeIds,
    locacao.dataEvento,
    locacaoId
  );
  await prisma.$transaction(async (tx) => {
    const trajesDb = await tx.traje.findMany({ where: { id: { in: trajeIds } } });
    for (const t of trajesDb) {
      if (t.status !== TrajeStatus.DISPONIVEL) {
        throw new AppError(400, `Traje ${t.codigo} não está disponível`);
      }
    }

    const ret = await tx.retirada.create({
      data: {
        locacaoId,
        dataRetirada: input.dataRetirada,
        status: RetiradaStatus.PENDENTE,
        trajesLocados: {
          create: input.trajes.map((row) => ({
            trajeId: row.trajeId,
            precisaLavagem: row.precisaLavagem ?? true,
            lavagemStatus: LavagemStatus.PENDENTE,
            status: TrajeLocadoStatus.AGUARDANDO_AJUSTE,
            ajustes:
              row.ajustes && row.ajustes.length
                ? {
                    create: row.ajustes.map((a) => ({
                      tipo: a.tipo,
                      descricao: a.descricao ?? null,
                      status: AjusteStatus.PENDENTE,
                    })),
                  }
                : undefined,
          })),
        },
      },
      include: { trajesLocados: true },
    });

    await tx.traje.updateMany({
      where: { id: { in: trajeIds } },
      data: { status: TrajeStatus.ALUGADO },
    });
    for (const tid of trajeIds) {
      await tx.movimentacao.create({
        data: {
          trajeId: tid,
          locacaoId,
          tipo: MovimentacaoTipo.SAIDA_ALUGUEL,
          observacao: "Saída por locação (nova retirada)",
        },
      });
    }
    for (const tl of ret.trajesLocados) {
      await recomputeTrajeLocado(tx, tl.id);
    }
    await syncRetiradaStatus(tx, ret.id);
    await tx.locacaoHistorico.create({
      data: {
        locacaoId,
        acao: "Retirada adicionada",
        detalhe: { retiradaId: ret.id, trajes: trajeIds },
      },
    });
  });

  return getLocacao(locacaoId);
}

export async function patchRetirada(
  retiradaId: string,
  data: { dataRetirada?: Date }
) {
  const ret = await prisma.retirada.findUnique({
    where: { id: retiradaId },
    include: { locacao: true },
  });
  if (!ret) throw new AppError(404, "Retirada não encontrada");

  const antes = ret.dataRetirada;
  const updated = await prisma.retirada.update({
    where: { id: retiradaId },
    data: { dataRetirada: data.dataRetirada ?? ret.dataRetirada },
  });
  await registrarHistorico(ret.locacaoId, "Data de retirada alterada", {
    retiradaId,
    antes,
    depois: updated.dataRetirada,
  });
  return updated;
}

export async function deleteRetirada(retiradaId: string) {
  const ret = await prisma.retirada.findUnique({
    where: { id: retiradaId },
    include: { trajesLocados: true, locacao: true },
  });
  if (!ret) throw new AppError(404, "Retirada não encontrada");
  if (ret.trajesLocados.length > 0) {
    throw new AppError(400, "Remova os trajes desta retirada antes de excluí-la");
  }
  await prisma.retirada.delete({ where: { id: retiradaId } });
  await registrarHistorico(ret.locacaoId, "Retirada removida", { retiradaId });
}

export async function addTrajeLocado(
  retiradaId: string,
  input: {
    trajeId: string;
    precisaLavagem?: boolean;
    ajustes?: { tipo: AjusteTipo; descricao?: string }[];
  }
) {
  const ret = await prisma.retirada.findUnique({
    where: { id: retiradaId },
    include: { locacao: true },
  });
  if (!ret) throw new AppError(404, "Retirada não encontrada");
  if (ret.locacao.encerrada) {
    throw new AppError(400, "Locação encerrada");
  }

  await assertTrajeLivreNaLocacao(ret.locacaoId, input.trajeId);
  await assertTrajesSemConflitoMesmoFimDeSemana(
    [input.trajeId],
    ret.locacao.dataEvento,
    ret.locacaoId
  );

  const tj = await prisma.traje.findUnique({ where: { id: input.trajeId } });
  if (!tj || tj.status !== TrajeStatus.DISPONIVEL) {
    throw new AppError(400, "Traje não disponível");
  }

  await prisma.$transaction(async (tx) => {
    const tl = await tx.trajeLocado.create({
      data: {
        retiradaId,
        trajeId: input.trajeId,
        precisaLavagem: input.precisaLavagem ?? true,
        lavagemStatus: LavagemStatus.PENDENTE,
        status: TrajeLocadoStatus.AGUARDANDO_AJUSTE,
        ajustes:
          input.ajustes && input.ajustes.length
            ? {
                create: input.ajustes.map((a) => ({
                  tipo: a.tipo,
                  descricao: a.descricao ?? null,
                  status: AjusteStatus.PENDENTE,
                })),
              }
            : undefined,
      },
    });
    await tx.traje.update({
      where: { id: input.trajeId },
      data: { status: TrajeStatus.ALUGADO },
    });
    await tx.movimentacao.create({
      data: {
        trajeId: input.trajeId,
        locacaoId: ret.locacaoId,
        tipo: MovimentacaoTipo.SAIDA_ALUGUEL,
        observacao: "Saída por locação (traje adicionado)",
      },
    });
    await recomputeTrajeLocado(tx, tl.id);
    await syncRetiradaStatus(tx, retiradaId);
    await tx.locacaoHistorico.create({
      data: {
        locacaoId: ret.locacaoId,
        acao: "Traje adicionado à retirada",
        detalhe: { trajeLocadoId: tl.id, trajeId: input.trajeId },
      },
    });
  });

  return getLocacao(ret.locacaoId);
}

export async function removeTrajeLocado(trajeLocadoId: string) {
  const tl = await prisma.trajeLocado.findUnique({
    where: { id: trajeLocadoId },
    include: { retirada: { include: { locacao: true } } },
  });
  if (!tl) throw new AppError(404, "Registro não encontrado");
  if (tl.retirada.locacao.encerrada) {
    throw new AppError(400, "Locação encerrada");
  }
  if (
    tl.status !== TrajeLocadoStatus.AGUARDANDO_AJUSTE &&
    tl.status !== TrajeLocadoStatus.EM_AJUSTE
  ) {
    throw new AppError(
      400,
      "Só é possível remover trajes ainda em preparação inicial"
    );
  }

  const locacaoId = tl.retirada.locacaoId;
  const retiradaId = tl.retiradaId;
  const trajeId = tl.trajeId;

  await prisma.$transaction(async (tx) => {
    await tx.trajeLocado.delete({ where: { id: trajeLocadoId } });
    await tx.traje.update({
      where: { id: trajeId },
      data: { status: TrajeStatus.DISPONIVEL },
    });
    await syncRetiradaStatus(tx, retiradaId);
    await tx.locacaoHistorico.create({
      data: {
        locacaoId,
        acao: "Traje removido da retirada",
        detalhe: { trajeLocadoId, trajeId },
      },
    });
  });

  await tryEncerrarLocacao(locacaoId);
  return getLocacao(locacaoId);
}

export async function patchTrajeLocado(
  trajeLocadoId: string,
  data: {
    precisaLavagem?: boolean;
    lavagemStatus?: LavagemStatus;
  }
) {
  const tl = await prisma.trajeLocado.findUnique({
    where: { id: trajeLocadoId },
    include: { retirada: true, ajustes: true },
  });
  if (!tl) throw new AppError(404, "Traje locado não encontrado");

  const locacaoId = (
    await prisma.retirada.findUniqueOrThrow({ where: { id: tl.retiradaId } })
  ).locacaoId;

  await prisma.trajeLocado.update({
    where: { id: trajeLocadoId },
    data: {
      precisaLavagem: data.precisaLavagem ?? undefined,
      lavagemStatus: data.lavagemStatus ?? undefined,
    },
  });
  if (data.precisaLavagem === false) {
    await prisma.trajeLocado.update({
      where: { id: trajeLocadoId },
      data: { lavagemStatus: LavagemStatus.FEITO },
    });
  }
  await registrarHistorico(locacaoId, "Traje locado atualizado", {
    trajeLocadoId,
    patch: data,
  });

  await recomputeTrajeLocado(prisma, trajeLocadoId);
  await syncRetiradaStatus(prisma, tl.retiradaId);
  return prisma.trajeLocado.findUniqueOrThrow({
    where: { id: trajeLocadoId },
    include: { traje: true, ajustes: true, retirada: true },
  });
}

export async function postEnviarParaLavagem(trajeLocadoId: string) {
  const tl = await prisma.trajeLocado.findUnique({
    where: { id: trajeLocadoId },
    include: { retirada: true },
  });
  if (!tl) throw new AppError(404, "Traje locado não encontrado");
  if (tl.status !== TrajeLocadoStatus.AJUSTADO) {
    throw new AppError(400, "Só é possível após o status Ajustado (costura concluída)");
  }
  await prisma.trajeLocado.update({
    where: { id: trajeLocadoId },
    data: { status: TrajeLocadoStatus.LAVAGEM_PENDENTE },
  });
  await registrarHistorico(
    (
      await prisma.retirada.findUniqueOrThrow({ where: { id: tl.retiradaId } })
    ).locacaoId,
    "Encaminhado para lavagem/passador",
    { trajeLocadoId }
  );
  await recomputeTrajeLocado(prisma, trajeLocadoId);
  await syncRetiradaStatus(prisma, tl.retiradaId);
  return prisma.trajeLocado.findUniqueOrThrow({
    where: { id: trajeLocadoId },
    include: { traje: true, ajustes: true },
  });
}

export async function postMarcarProntoRetirada(trajeLocadoId: string) {
  await assertPodeMarcarProntoManual(trajeLocadoId);
  const tl = await prisma.trajeLocado.findUnique({
    where: { id: trajeLocadoId },
    include: { retirada: true },
  });
  if (!tl) throw new AppError(404, "Traje locado não encontrado");

  await prisma.trajeLocado.update({
    where: { id: trajeLocadoId },
    data: { status: TrajeLocadoStatus.PRONTO_RETIRADA },
  });
  await registrarHistorico(
    (
      await prisma.retirada.findUniqueOrThrow({ where: { id: tl.retiradaId } })
    ).locacaoId,
    "Marcado como pronto para retirada (manual)",
    { trajeLocadoId }
  );
  await syncRetiradaStatus(prisma, tl.retiradaId);
  return prisma.trajeLocado.findUniqueOrThrow({
    where: { id: trajeLocadoId },
    include: { traje: true, ajustes: true },
  });
}

export async function postIniciarLavagem(trajeLocadoId: string) {
  const tl = await prisma.trajeLocado.findUnique({
    where: { id: trajeLocadoId },
    include: { retirada: true },
  });
  if (!tl) throw new AppError(404, "Traje locado não encontrado");
  await prisma.trajeLocado.update({
    where: { id: trajeLocadoId },
    data: {
      lavagemStatus: LavagemStatus.EM_ANDAMENTO,
    },
  });
  await recomputeTrajeLocado(prisma, trajeLocadoId);
  await registrarHistorico(
    (
      await prisma.retirada.findUniqueOrThrow({ where: { id: tl.retiradaId } })
    ).locacaoId,
    "Lavagem/preparação iniciada",
    { trajeLocadoId }
  );
  await syncRetiradaStatus(prisma, tl.retiradaId);
  return prisma.trajeLocado.findUniqueOrThrow({
    where: { id: trajeLocadoId },
    include: { traje: true, ajustes: true },
  });
}

export async function postConcluirLavagem(trajeLocadoId: string) {
  const tl = await prisma.trajeLocado.findUnique({
    where: { id: trajeLocadoId },
    include: { retirada: true },
  });
  if (!tl) throw new AppError(404, "Traje locado não encontrado");
  await prisma.trajeLocado.update({
    where: { id: trajeLocadoId },
    data: { lavagemStatus: LavagemStatus.FEITO },
  });
  await recomputeTrajeLocado(prisma, trajeLocadoId);
  await registrarHistorico(
    (
      await prisma.retirada.findUniqueOrThrow({ where: { id: tl.retiradaId } })
    ).locacaoId,
    "Lavagem/preparação concluída",
    { trajeLocadoId }
  );
  await syncRetiradaStatus(prisma, tl.retiradaId);
  return prisma.trajeLocado.findUniqueOrThrow({
    where: { id: trajeLocadoId },
    include: { traje: true, ajustes: true },
  });
}

export async function postTrajeRetirado(trajeLocadoId: string) {
  const tl = await prisma.trajeLocado.findUnique({
    where: { id: trajeLocadoId },
    include: { retirada: true },
  });
  if (!tl) throw new AppError(404, "Traje locado não encontrado");
  if (tl.status !== TrajeLocadoStatus.PRONTO_RETIRADA) {
    throw new AppError(400, "Traje precisa estar pronto para retirada");
  }
  await prisma.trajeLocado.update({
    where: { id: trajeLocadoId },
    data: { status: TrajeLocadoStatus.RETIRADO },
  });
  await registrarHistorico(
    (
      await prisma.retirada.findUniqueOrThrow({ where: { id: tl.retiradaId } })
    ).locacaoId,
    "Traje retirado pelo cliente",
    { trajeLocadoId }
  );
  await syncRetiradaStatus(prisma, tl.retiradaId);
  return prisma.trajeLocado.findUniqueOrThrow({
    where: { id: trajeLocadoId },
    include: { traje: true },
  });
}

export async function postTrajeFinalizado(trajeLocadoId: string) {
  const tl = await prisma.trajeLocado.findUnique({
    where: { id: trajeLocadoId },
    include: { traje: true, retirada: true },
  });
  if (!tl) throw new AppError(404, "Traje locado não encontrado");
  if (tl.status !== TrajeLocadoStatus.RETIRADO) {
    throw new AppError(400, "Traje precisa estar em status Retirado");
  }

  const locacaoId = (
    await prisma.retirada.findUniqueOrThrow({ where: { id: tl.retiradaId } })
  ).locacaoId;

  await prisma.$transaction(async (tx) => {
    await tx.trajeLocado.update({
      where: { id: trajeLocadoId },
      data: { status: TrajeLocadoStatus.FINALIZADO },
    });
    await tx.traje.update({
      where: { id: tl.trajeId },
      data: { status: TrajeStatus.DISPONIVEL },
    });
    await tx.movimentacao.create({
      data: {
        trajeId: tl.trajeId,
        locacaoId,
        tipo: MovimentacaoTipo.ENTRADA_DEVOLUCAO,
        observacao: "Devolução — traje finalizado",
      },
    });
    await tx.locacaoHistorico.create({
      data: {
        locacaoId,
        acao: "Traje finalizado (devolvido)",
        detalhe: { trajeLocadoId },
      },
    });
  });

  await syncRetiradaStatus(prisma, tl.retiradaId);
  await tryEncerrarLocacao(locacaoId);
  return prisma.trajeLocado.findUniqueOrThrow({
    where: { id: trajeLocadoId },
    include: { traje: true },
  });
}

async function tryEncerrarLocacao(locacaoId: string): Promise<void> {
  const loc = await prisma.locacao.findUnique({
    where: { id: locacaoId },
    include: {
      retiradas: { include: { trajesLocados: true } },
    },
  });
  if (!loc || loc.encerrada) return;

  const all = loc.retiradas.flatMap((r) => r.trajesLocados);
  if (all.length === 0) return;
  const done = all.every((t) => t.status === TrajeLocadoStatus.FINALIZADO);
  if (done) {
    await prisma.locacao.update({
      where: { id: locacaoId },
      data: { encerrada: true },
    });
    await registrarHistorico(locacaoId, "Locação encerrada (todos os trajes finalizados)", {});
  }
}

export async function registrarPagamento(
  locacaoId: string,
  valor: Prisma.Decimal | number | string,
  tipo: TipoPagamentoRegistro
) {
  const loc = await getLocacao(locacaoId);
  const v = new Prisma.Decimal(valor);
  if (v.lte(0)) throw new AppError(400, "Valor inválido");

  const novoPago = new Prisma.Decimal(loc.valorPago.toString()).plus(v);
  if (novoPago.gt(loc.valorTotal)) {
    throw new AppError(400, "Pagamento excede o valor restante");
  }

  const statusPagamento = derivePaymentStatus(loc.valorTotal, novoPago);

  await prisma.$transaction([
    prisma.pagamento.create({
      data: { locacaoId, valor: v, tipo },
    }),
    prisma.locacao.update({
      where: { id: locacaoId },
      data: { valorPago: novoPago, statusPagamento },
    }),
  ]);

  return getLocacao(locacaoId);
}

/**
 * Registra pagamento informando apenas o valor desta quitação (parcial ou total).
 * O tipo SINAL/PARCIAL/FINAL é escolhido automaticamente conforme o saldo restante.
 */
export async function registrarPagamentoPorValorPago(
  locacaoId: string,
  valorPagoRegistro: number
) {
  const loc = await getLocacao(locacaoId);
  const rem = computeRemaining(loc.valorTotal, loc.valorPago);
  const v = new Prisma.Decimal(Number(valorPagoRegistro).toFixed(2));
  if (v.lte(0)) {
    throw new AppError(400, "O valor do pagamento deve ser maior que zero");
  }
  if (v.gt(rem)) {
    throw new AppError(400, "Valor superior ao restante da locação");
  }
  const tipo = v.equals(rem)
    ? TipoPagamentoRegistro.FINAL
    : TipoPagamentoRegistro.PARCIAL;
  return registrarPagamento(locacaoId, v, tipo);
}

/**
 * Locações com saldo em aberto: pendentes ou parciais (inclui encerradas / “finalizadas”
 * operacionalmente que ainda precisam receber).
 */
export async function listarPagamentosPendentes() {
  return prisma.locacao.findMany({
    where: {
      statusPagamento: {
        in: [
          PagamentoLocacaoStatus.PENDENTE,
          PagamentoLocacaoStatus.PARCIAL,
        ],
      },
    },
    include: {
      cliente: true,
      retiradas: {
        include: { trajesLocados: { include: { traje: true } } },
      },
    },
    orderBy: [{ encerrada: "desc" }, { dataAluguel: "asc" }],
  });
}

export async function relatorioFinanceiro(filters: { inicio?: Date; fim?: Date }) {
  const locs = await prisma.locacao.findMany({
    where:
      filters.inicio || filters.fim
        ? {
            dataAluguel: {
              ...(filters.inicio ? { gte: filters.inicio } : {}),
              ...(filters.fim ? { lte: filters.fim } : {}),
            },
          }
        : {},
  });

  let totalContratado = new Prisma.Decimal(0);
  let totalRecebido = new Prisma.Decimal(0);
  for (const l of locs) {
    totalContratado = totalContratado.plus(l.valorTotal);
    totalRecebido = totalRecebido.plus(l.valorPago);
  }

  return {
    quantidade: locs.length,
    totalContratado: totalContratado.toFixed(2),
    totalRecebido: totalRecebido.toFixed(2),
    totalAReceber: totalContratado.minus(totalRecebido).toFixed(2),
  };
}

export async function listMovimentacoes(trajeId?: string) {
  return prisma.movimentacao.findMany({
    where: trajeId ? { trajeId } : undefined,
    include: { traje: true, locacao: { include: { cliente: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
