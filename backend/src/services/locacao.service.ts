import {
  AjusteStatus,
  AjusteTipo,
  LavagemStatus,
  LocacaoStatus,
  MovimentacaoTipo,
  PagamentoLocacaoStatus,
  Prisma,
  RetiradaStatus,
  TipoPagamentoRegistro,
  TrajeLocadoStatus,
  TrajeStatus,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { clampDataRetiradaCriacaoUtc } from "../utils/dataRetiradaSugestao.js";
import { AppError } from "../middleware/errorHandler.js";
import { computeRemaining, derivePaymentStatus } from "./finance.service.js";
import { registrarHistorico } from "./locacaoHistorico.service.js";
import { sendConfirmacaoAluguel } from "./notificacao.service.js";
import {
  assertPodeMarcarProntoManual,
  initialTrajeLocadoState,
  recomputeTrajeLocado,
  syncRetiradaStatus,
} from "./trajeLocadoWorkflow.service.js";
import { assertTrajeIntervaloMinimoLocacoes } from "./locacaoIntervaloTraje.service.js";

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
  /** Obrigatório na criação (regra dos 5 dias e negócio). */
  dataEvento: Date;
  dataDevolucaoPrevista?: Date | null;
  valorTotal: Prisma.Decimal | string | number;
  valorPagoInicial?: Prisma.Decimal | string | number;
  retiradas: RetiradaCreateRaw[];
  /** Itens sem código (acessórios), só texto na locação. */
  itensDescritivos?: {
    descricao: string;
    quantidade?: number | null;
    variacao?: string | null;
    observacao?: string | null;
    separado?: boolean | null;
  }[];
}

export type ItemDescritivoNormalizado = {
  descricao: string;
  quantidade: number;
  variacao: string | null;
  observacao: string | null;
  separado: boolean;
};

/** Linhas com descrição vazia após trim são descartadas. */
export function normalizarItensDescritivos(
  raw?: {
    descricao: string;
    quantidade?: number | null;
    variacao?: string | null;
    observacao?: string | null;
    separado?: boolean | null;
  }[]
): ItemDescritivoNormalizado[] {
  if (!raw?.length) return [];
  const out: ItemDescritivoNormalizado[] = [];
  for (const row of raw) {
    const descricao = row.descricao.trim();
    if (!descricao) continue;
    const variacao = row.variacao?.trim() ? row.variacao.trim() : null;
    const observacao = row.observacao?.trim() ? row.observacao.trim() : null;
    const qRaw = Number(row.quantidade ?? 1);
    const quantidade = Number.isFinite(qRaw)
      ? Math.min(999, Math.max(1, Math.floor(qRaw)))
      : 1;
    const separado = Boolean(row.separado);
    out.push({ descricao, quantidade, variacao, observacao, separado });
  }
  return out;
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

export function assertLocacaoNaoCancelada(
  loc: { statusLocacao: LocacaoStatus } | null | undefined,
  mensagem = "Operação não permitida: locação cancelada"
): void {
  if (loc?.statusLocacao === LocacaoStatus.CANCELADA) {
    throw new AppError(400, mensagem);
  }
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
  const agoraCriacao = new Date();
  const retiradasValidas = filtrarRetiradasValidas(input.retiradas).map((r) => ({
    ...r,
    dataRetirada: clampDataRetiradaCriacaoUtc(
      r.dataRetirada,
      input.dataEvento,
      agoraCriacao
    ),
  }));
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

  const dataInicioRef = input.dataEvento;
  for (const tid of new Set(allTrajes)) {
    await assertTrajeIntervaloMinimoLocacoes(tid, dataInicioRef);
  }

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

    const statusPagamento = derivePaymentStatus(valorTotal, valorPagoInicial);
    const itensDesc = normalizarItensDescritivos(input.itensDescritivos);

    const loc = await tx.locacao.create({
      data: {
        clienteId: inputComRetiradas.clienteId,
        observacoes: inputComRetiradas.observacoes ?? null,
        dataEvento: inputComRetiradas.dataEvento,
        dataDevolucaoPrevista: inputComRetiradas.dataDevolucaoPrevista ?? null,
        valorTotal,
        valorPago: valorPagoInicial,
        statusPagamento,
        ...(itensDesc.length > 0
          ? {
              itensDescritivos: {
                create: itensDesc.map((row, ordem) => ({
                  descricao: row.descricao,
                  quantidade: row.quantidade,
                  variacao: row.variacao,
                  observacao: row.observacao,
                  separado: row.separado,
                  ordem,
                })),
              },
            }
          : {}),
        retiradas: {
          create: retiradasValidas.map((r) => ({
            dataRetirada: r.dataRetirada,
            status: RetiradaStatus.PENDENTE,
            trajesLocados: {
              create: r.trajes.map((row) => {
                const temAjustes = Boolean(row.ajustes && row.ajustes.length > 0);
                const precisaLavagem = row.precisaLavagem ?? true;
                const init = initialTrajeLocadoState({
                  temAjustesPendentes: temAjustes,
                  precisaLavagem,
                });
                return {
                  trajeId: row.trajeId,
                  precisaLavagem,
                  lavagemStatus: LavagemStatus.PENDENTE,
                  status: init.status,
                  precisaAjuste: init.precisaAjuste,
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
                };
              }),
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
          itensDescritivos: itensDesc.length,
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
  if (enc !== undefined) {
    where.encerrada = enc;
    if (enc === false) {
      where.statusLocacao = LocacaoStatus.ATIVA;
    }
  }
  if (filters.dataEvento && /^\d{4}-\d{2}-\d{2}$/.test(filters.dataEvento)) {
    const { gte, lte } = utcDayRangeFromYmd(filters.dataEvento);
    where.dataEvento = { gte, lte };
  }

  const rows = await prisma.locacao.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    include: {
      cliente: true,
      itensDescritivos: { orderBy: { ordem: "asc" } },
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

/** GET/PATCH de locação: inclui `itensDescritivos` (acessórios sem código), ordenados. */
export async function getLocacao(id: string) {
  const l = await prisma.locacao.findUnique({
    where: { id },
    include: {
      cliente: true,
      itensDescritivos: { orderBy: { ordem: "asc" } },
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
    itensDescritivos?: {
      descricao: string;
      quantidade?: number | null;
      variacao?: string | null;
      observacao?: string | null;
      separado?: boolean | null;
    }[];
  }
) {
  const antes = await getLocacao(id);
  assertLocacaoNaoCancelada(antes);
  if (data.dataEvento !== undefined) {
    const novoRef =
      data.dataEvento === null ? antes.dataAluguel : data.dataEvento;
    for (const tid of coletarTrajeIdsDaLocacao(antes)) {
      await assertTrajeIntervaloMinimoLocacoes(tid, novoRef, {
        excludeLocacaoId: id,
      });
    }
  }

  const itensNovos =
    data.itensDescritivos !== undefined
      ? normalizarItensDescritivos(data.itensDescritivos)
      : undefined;

  const dadosLocacao: Prisma.LocacaoUpdateInput = {
    ...(data.observacoes !== undefined ? { observacoes: data.observacoes } : {}),
    ...(data.dataEvento !== undefined ? { dataEvento: data.dataEvento } : {}),
    ...(data.dataDevolucaoPrevista !== undefined
      ? { dataDevolucaoPrevista: data.dataDevolucaoPrevista }
      : {}),
  };
  const temUpdateLocacao = Object.keys(dadosLocacao).length > 0;
  const mudouItens = itensNovos !== undefined;

  if (!temUpdateLocacao && !mudouItens) {
    return getLocacao(id);
  }

  await prisma.$transaction(async (tx) => {
    if (temUpdateLocacao) {
      await tx.locacao.update({ where: { id }, data: dadosLocacao });
    }

    if (mudouItens) {
      await tx.locacaoItemDescritivo.deleteMany({ where: { locacaoId: id } });
      if (itensNovos!.length > 0) {
        await tx.locacaoItemDescritivo.createMany({
          data: itensNovos!.map((row, ordem) => ({
            locacaoId: id,
            descricao: row.descricao,
            quantidade: row.quantidade,
            variacao: row.variacao,
            observacao: row.observacao,
            separado: row.separado,
            ordem,
          })),
        });
      }
    }
  });

  const loc = await getLocacao(id);

  await registrarHistorico(id, "Locação atualizada", {
    antes: {
      observacoes: antes.observacoes,
      dataEvento: antes.dataEvento,
      dataDevolucaoPrevista: antes.dataDevolucaoPrevista,
      itensDescritivos: antes.itensDescritivos.map((i) => ({
        descricao: i.descricao,
        quantidade: i.quantidade,
        variacao: i.variacao,
        observacao: i.observacao,
        separado: i.separado,
      })),
    },
    depois: {
      observacoes: loc.observacoes,
      dataEvento: loc.dataEvento,
      dataDevolucaoPrevista: loc.dataDevolucaoPrevista,
      itensDescritivos: loc.itensDescritivos.map((i) => ({
        descricao: i.descricao,
        quantidade: i.quantidade,
        variacao: i.variacao,
        observacao: i.observacao,
        separado: i.separado,
      })),
    },
  });
  return loc;
}

export async function patchLocacaoItemDescritivoSeparado(
  locacaoId: string,
  itemId: string,
  separado: boolean
) {
  const loc = await prisma.locacao.findUnique({
    where: { id: locacaoId },
    select: { encerrada: true, statusLocacao: true },
  });
  if (!loc) throw new AppError(404, "Locação não encontrada");
  assertLocacaoNaoCancelada(loc);
  if (loc.encerrada) {
    throw new AppError(400, "Locação encerrada: não é possível alterar acessórios");
  }
  const item = await prisma.locacaoItemDescritivo.findFirst({
    where: { id: itemId, locacaoId },
  });
  if (!item) {
    throw new AppError(404, "Acessório não encontrado nesta locação");
  }
  await prisma.locacaoItemDescritivo.update({
    where: { id: itemId },
    data: { separado },
  });
  return getLocacao(locacaoId);
}

export async function addRetirada(locacaoId: string, input: RetiradaInput) {
  const locacao = await getLocacao(locacaoId);
  assertLocacaoNaoCancelada(locacao);
  if (!input.trajes.length) throw new AppError(400, "Retirada sem trajes");

  for (const t of input.trajes) {
    await assertTrajeLivreNaLocacao(locacaoId, t.trajeId);
  }

  const trajeIds = input.trajes.map((t) => t.trajeId);
  const uniqueTrajeIds = [...new Set(trajeIds)];

  const refLocacao = locacao.dataEvento ?? locacao.dataAluguel;
  for (const tid of uniqueTrajeIds) {
    await assertTrajeIntervaloMinimoLocacoes(tid, refLocacao, {
      excludeLocacaoId: locacaoId,
    });
  }

  await prisma.$transaction(async (tx) => {
    const trajesDb = await tx.traje.findMany({
      where: { id: { in: uniqueTrajeIds } },
    });
    if (trajesDb.length !== uniqueTrajeIds.length) {
      throw new AppError(400, "Traje não encontrado");
    }

    const ret = await tx.retirada.create({
      data: {
        locacaoId,
        dataRetirada: input.dataRetirada,
        status: RetiradaStatus.PENDENTE,
        trajesLocados: {
          create: input.trajes.map((row) => {
            const temAjustes = Boolean(row.ajustes && row.ajustes.length);
            const precisaLavagem = row.precisaLavagem ?? true;
            const init = initialTrajeLocadoState({
              temAjustesPendentes: temAjustes,
              precisaLavagem,
            });
            return {
              trajeId: row.trajeId,
              precisaLavagem,
              lavagemStatus: LavagemStatus.PENDENTE,
              status: init.status,
              precisaAjuste: init.precisaAjuste,
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
            };
          }),
        },
      },
      include: { trajesLocados: true },
    });

    await tx.traje.updateMany({
      where: { id: { in: uniqueTrajeIds } },
      data: { status: TrajeStatus.ALUGADO },
    });
    for (const tid of uniqueTrajeIds) {
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
        detalhe: { retiradaId: ret.id, trajes: uniqueTrajeIds },
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
  assertLocacaoNaoCancelada(ret.locacao);

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
  assertLocacaoNaoCancelada(ret.locacao);
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
  assertLocacaoNaoCancelada(ret.locacao);
  if (ret.locacao.encerrada) {
    throw new AppError(400, "Locação encerrada");
  }

  await assertTrajeLivreNaLocacao(ret.locacaoId, input.trajeId);

  const refLocacao = ret.locacao.dataEvento ?? ret.locacao.dataAluguel;
  await assertTrajeIntervaloMinimoLocacoes(input.trajeId, refLocacao, {
    excludeLocacaoId: ret.locacaoId,
  });

  const tj = await prisma.traje.findUnique({ where: { id: input.trajeId } });
  if (!tj) {
    throw new AppError(400, "Traje não encontrado");
  }

  await prisma.$transaction(async (tx) => {
    const temAjustes = Boolean(input.ajustes && input.ajustes.length);
    const precisaLavagem = input.precisaLavagem ?? true;
    const init = initialTrajeLocadoState({
      temAjustesPendentes: temAjustes,
      precisaLavagem,
    });
    const tl = await tx.trajeLocado.create({
      data: {
        retiradaId,
        trajeId: input.trajeId,
        precisaLavagem,
        lavagemStatus: LavagemStatus.PENDENTE,
        status: init.status,
        precisaAjuste: init.precisaAjuste,
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
  assertLocacaoNaoCancelada(tl.retirada.locacao);
  if (tl.retirada.locacao.encerrada) {
    throw new AppError(400, "Locação encerrada");
  }
  if (
    tl.status !== TrajeLocadoStatus.PRONTO &&
    tl.status !== TrajeLocadoStatus.COSTUREIRA
  ) {
    throw new AppError(
      400,
      "Só é possível remover trajes ainda em preparação inicial (Pronto ou Costureira)"
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

/** Envia à costureira: só após ação explícita, com ajustes pendentes. */
export async function postEnviarParaCostureira(trajeLocadoId: string) {
  const tl = await prisma.trajeLocado.findUnique({
    where: { id: trajeLocadoId },
    include: { retirada: true, ajustes: true },
  });
  if (!tl) throw new AppError(404, "Traje locado não encontrado");
  if (tl.status !== TrajeLocadoStatus.PRONTO) {
    throw new AppError(
      400,
      "Só é possível enviar à costureira quando o traje está em “Pronto” (pré-envio)"
    );
  }
  if (!tl.precisaAjuste) {
    throw new AppError(
      400,
      "Não há ajuste pendente marcado para este traje"
    );
  }
  await prisma.trajeLocado.update({
    where: { id: trajeLocadoId },
    data: { status: TrajeLocadoStatus.COSTUREIRA },
  });
  await registrarHistorico(
    (
      await prisma.retirada.findUniqueOrThrow({ where: { id: tl.retiradaId } })
    ).locacaoId,
    "Enviado à costureira",
    { trajeLocadoId }
  );
  await recomputeTrajeLocado(prisma, trajeLocadoId);
  return prisma.trajeLocado.findUniqueOrThrow({
    where: { id: trajeLocadoId },
    include: { traje: true, ajustes: true },
  });
}

/** Compatível com clientes antigos: equivalente a iniciar lavagem na etapa LAVANDO. */
export async function postEnviarParaLavagem(trajeLocadoId: string) {
  return postIniciarLavagem(trajeLocadoId);
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
    data: { status: TrajeLocadoStatus.PRONTO },
  });
  await registrarHistorico(
    (
      await prisma.retirada.findUniqueOrThrow({ where: { id: tl.retiradaId } })
    ).locacaoId,
    "Passador concluído — pronto para retirada",
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
  if (tl.status !== TrajeLocadoStatus.LAVANDO) {
    throw new AppError(
      400,
      "Iniciar lavagem só é permitido na etapa “Lavando”"
    );
  }
  if (tl.lavagemStatus !== LavagemStatus.PENDENTE) {
    throw new AppError(
      400,
      "A lavagem já foi iniciada ou não se aplica neste estado"
    );
  }
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
  if (tl.status !== TrajeLocadoStatus.LAVANDO) {
    throw new AppError(400, "Concluir lavagem só na etapa “Lavando”");
  }
  if (tl.lavagemStatus !== LavagemStatus.EM_ANDAMENTO) {
    throw new AppError(
      400,
      "É preciso iniciar a lavagem antes de concluí-la"
    );
  }
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
  if (tl.status !== TrajeLocadoStatus.PRONTO) {
    throw new AppError(400, "Traje precisa estar em “Pronto” para retirada");
  }
  if (tl.precisaAjuste) {
    throw new AppError(
      400,
      "Não é possível marcar retirada enquanto houver ajuste pendente ou o traje não tiver concluído o fluxo de preparação"
    );
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
      data: { status: TrajeLocadoStatus.DEVOLUCAO_FEITA },
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
  const done = all.every((t) => t.status === TrajeLocadoStatus.DEVOLUCAO_FEITA);
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
  assertLocacaoNaoCancelada(loc, "Não é possível registrar pagamento em locação cancelada");
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
  assertLocacaoNaoCancelada(loc, "Não é possível registrar pagamento em locação cancelada");
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
 * Cancela a locação: status CANCELADA, zera receita reconhecida na locação, marca pagamentos
 * anteriores como estornados, cria lançamento ESTORNO_CANCELAMENTO, libera trajes e registra histórico.
 */
export async function cancelarLocacao(
  locacaoId: string,
  opts: { motivo?: string | null; adminUserId?: string | null }
) {
  const agora = new Date();

  await prisma.$transaction(async (tx) => {
    const loc = await tx.locacao.findUnique({
      where: { id: locacaoId },
      include: {
        pagamentos: true,
        retiradas: { include: { trajesLocados: true } },
      },
    });
    if (!loc) throw new AppError(404, "Locação não encontrada");
    if (loc.statusLocacao === LocacaoStatus.CANCELADA) {
      throw new AppError(400, "Locação já está cancelada");
    }
    if (loc.encerrada) {
      throw new AppError(
        400,
        "Não é possível cancelar uma locação já encerrada (todos os trajes foram finalizados)"
      );
    }

    const trajeIds = [
      ...new Set(
        loc.retiradas.flatMap((r) => r.trajesLocados.map((tl) => tl.trajeId))
      ),
    ];

    const pagamentosAtivos = loc.pagamentos.filter(
      (p) =>
        !p.estornado && p.tipo !== TipoPagamentoRegistro.ESTORNO_CANCELAMENTO
    );
    const totalPago = pagamentosAtivos.reduce(
      (acc, p) => acc.plus(p.valor),
      new Prisma.Decimal(0)
    );

    if (pagamentosAtivos.length > 0) {
      await tx.pagamento.updateMany({
        where: {
          locacaoId,
          estornado: false,
          tipo: { not: TipoPagamentoRegistro.ESTORNO_CANCELAMENTO },
        },
        data: { estornado: true, estornadoEm: agora },
      });
    }

    if (totalPago.gt(0)) {
      await tx.pagamento.create({
        data: {
          locacaoId,
          valor: totalPago,
          tipo: TipoPagamentoRegistro.ESTORNO_CANCELAMENTO,
        },
      });
    }

    await tx.locacao.update({
      where: { id: locacaoId },
      data: {
        statusLocacao: LocacaoStatus.CANCELADA,
        encerrada: true,
        canceladaEm: agora,
        canceladaMotivo: opts.motivo?.trim() ? opts.motivo.trim() : null,
        canceladaPorUserId: opts.adminUserId?.trim()
          ? opts.adminUserId.trim()
          : null,
        valorPago: new Prisma.Decimal(0),
        statusPagamento: PagamentoLocacaoStatus.CANCELADA,
      },
    });

    if (trajeIds.length > 0) {
      await tx.traje.updateMany({
        where: { id: { in: trajeIds } },
        data: { status: TrajeStatus.DISPONIVEL },
      });
      for (const tid of trajeIds) {
        await tx.movimentacao.create({
          data: {
            trajeId: tid,
            locacaoId,
            tipo: MovimentacaoTipo.ENTRADA_DEVOLUCAO,
            observacao: "Devolução ao cancelamento da locação",
          },
        });
      }
    }

    await tx.locacaoHistorico.create({
      data: {
        locacaoId,
        acao: "Locação cancelada",
        detalhe: {
          motivo: opts.motivo?.trim() ?? null,
          adminUserId: opts.adminUserId ?? null,
          valorEstornado: totalPago.toFixed(2),
          trajesLiberados: trajeIds,
          pagamentosMarcadosEstorno: pagamentosAtivos.map((p) => p.id),
        },
      },
    });
  });

  return getLocacao(locacaoId);
}

/**
 * Locações com saldo em aberto: pendentes ou parciais (inclui encerradas / “finalizadas”
 * operacionalmente que ainda precisam receber).
 */
export async function listarPagamentosPendentes() {
  return prisma.locacao.findMany({
    where: {
      statusLocacao: LocacaoStatus.ATIVA,
      statusPagamento: {
        in: [
          PagamentoLocacaoStatus.PENDENTE,
          PagamentoLocacaoStatus.PARCIAL,
        ],
      },
    },
    include: {
      cliente: true,
      itensDescritivos: { orderBy: { ordem: "asc" } },
      retiradas: {
        include: { trajesLocados: { include: { traje: true } } },
      },
    },
    orderBy: [{ encerrada: "desc" }, { dataAluguel: "asc" }],
  });
}

export async function relatorioFinanceiro(filters: { inicio?: Date; fim?: Date }) {
  const locs = await prisma.locacao.findMany({
    where: {
      statusLocacao: { not: LocacaoStatus.CANCELADA },
      ...(filters.inicio || filters.fim
        ? {
            dataAluguel: {
              ...(filters.inicio ? { gte: filters.inicio } : {}),
              ...(filters.fim ? { lte: filters.fim } : {}),
            },
          }
        : {}),
    },
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
