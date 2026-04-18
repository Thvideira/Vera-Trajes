import {
  AjusteStatus,
  LavagemStatus,
  Prisma,
  RetiradaStatus,
  TrajeLocadoStatus,
} from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export type TrajeLocadoComAjustes = {
  id: string;
  status: TrajeLocadoStatus;
  precisaAjuste: boolean;
  precisaLavagem: boolean;
  lavagemStatus: LavagemStatus;
  ajustes: { status: AjusteStatus }[];
};

export function derivePrecisaAjuste(
  ajustes: { status: AjusteStatus }[]
): boolean {
  return ajustes.some((a) => a.status === AjusteStatus.PENDENTE);
}

/** Estado inicial ao criar traje na locação (antes do primeiro recompute). */
export function initialTrajeLocadoState(input: {
  temAjustesPendentes: boolean;
  precisaLavagem: boolean;
}): { status: TrajeLocadoStatus; precisaAjuste: boolean } {
  if (input.temAjustesPendentes) {
    return { status: TrajeLocadoStatus.PRONTO, precisaAjuste: true };
  }
  if (input.precisaLavagem) {
    return { status: TrajeLocadoStatus.LAVANDO, precisaAjuste: false };
  }
  return { status: TrajeLocadoStatus.PRONTO, precisaAjuste: false };
}

/**
 * Sincroniza `precisaAjuste` e transições automáticas permitidas:
 * - COSTUREIRA + sem ajustes pendentes → LAVANDO ou PRONTO
 * - LAVANDO + lavagem FEITA → FALTA_PASSAR (quando precisa lavagem)
 */
export function computeTrajeLocadoPatch(
  tl: TrajeLocadoComAjustes
): { precisaAjuste: boolean; status?: TrajeLocadoStatus } {
  const precisaAjuste = derivePrecisaAjuste(tl.ajustes);

  if (
    tl.status === TrajeLocadoStatus.RETIRADO ||
    tl.status === TrajeLocadoStatus.DEVOLUCAO_FEITA
  ) {
    return { precisaAjuste };
  }

  if (tl.status === TrajeLocadoStatus.COSTUREIRA && !precisaAjuste) {
    if (tl.precisaLavagem) {
      return { precisaAjuste, status: TrajeLocadoStatus.LAVANDO };
    }
    return { precisaAjuste, status: TrajeLocadoStatus.PRONTO };
  }

  if (
    tl.status === TrajeLocadoStatus.LAVANDO &&
    tl.precisaLavagem &&
    tl.lavagemStatus === LavagemStatus.FEITO
  ) {
    return { precisaAjuste, status: TrajeLocadoStatus.FALTA_PASSAR };
  }

  return { precisaAjuste };
}

export function podeSerProntoRetirada(tl: TrajeLocadoComAjustes): boolean {
  const allDone =
    tl.ajustes.length === 0 ||
    tl.ajustes.every((a) => a.status === AjusteStatus.CONCLUIDO);
  const lavOk = !tl.precisaLavagem || tl.lavagemStatus === LavagemStatus.FEITO;
  return allDone && lavOk && tl.status === TrajeLocadoStatus.FALTA_PASSAR;
}

export async function recomputeTrajeLocado(
  db: Tx | PrismaClient,
  trajeLocadoId: string
): Promise<void> {
  const tl = await db.trajeLocado.findUnique({
    where: { id: trajeLocadoId },
    include: { ajustes: true },
  });
  if (!tl) return;

  const patch = computeTrajeLocadoPatch({
    id: tl.id,
    status: tl.status,
    precisaAjuste: tl.precisaAjuste,
    precisaLavagem: tl.precisaLavagem,
    lavagemStatus: tl.lavagemStatus,
    ajustes: tl.ajustes.map((a) => ({ status: a.status })),
  });

  const data: Prisma.TrajeLocadoUpdateInput = {
    precisaAjuste: patch.precisaAjuste,
  };
  if (patch.status !== undefined && patch.status !== tl.status) {
    data.status = patch.status;
  }

  const needsUpdate =
    patch.precisaAjuste !== tl.precisaAjuste ||
    (patch.status !== undefined && patch.status !== tl.status);

  if (needsUpdate) {
    await db.trajeLocado.update({
      where: { id: trajeLocadoId },
      data,
    });
  }

  await syncRetiradaStatus(db, tl.retiradaId);
}

export async function syncRetiradaStatus(
  db: Tx | PrismaClient,
  retiradaId: string
): Promise<void> {
  const ret = await db.retirada.findUnique({
    where: { id: retiradaId },
    include: { trajesLocados: true },
  });
  if (!ret || ret.trajesLocados.length === 0) return;

  const isProntoOuMais = (s: TrajeLocadoStatus) =>
    s === TrajeLocadoStatus.PRONTO ||
    s === TrajeLocadoStatus.RETIRADO ||
    s === TrajeLocadoStatus.DEVOLUCAO_FEITA;
  const isRetiradoOuFinal = (s: TrajeLocadoStatus) =>
    s === TrajeLocadoStatus.RETIRADO ||
    s === TrajeLocadoStatus.DEVOLUCAO_FEITA;

  const prontos = ret.trajesLocados.filter((t) => isProntoOuMais(t.status));
  const retirados = ret.trajesLocados.filter((t) => isRetiradoOuFinal(t.status));

  let status: RetiradaStatus = RetiradaStatus.PENDENTE;
  if (retirados.length === ret.trajesLocados.length) {
    status = RetiradaStatus.RETIRADO;
  } else if (prontos.length === ret.trajesLocados.length) {
    status = RetiradaStatus.PRONTO;
  }

  if (status !== ret.status) {
    await db.retirada.update({
      where: { id: retiradaId },
      data: { status },
    });
  }
}

export async function assertPodeMarcarProntoManual(
  trajeLocadoId: string
): Promise<void> {
  const tl = await prisma.trajeLocado.findUnique({
    where: { id: trajeLocadoId },
    include: { ajustes: true },
  });
  if (!tl) throw new AppError(404, "Traje locado não encontrado");
  if (!podeSerProntoRetirada(tl)) {
    throw new AppError(
      400,
      "Só é possível marcar como pronto após a etapa “Falta passar”, com todos os ajustes concluídos e lavagem feita (ou lavagem desmarcada)"
    );
  }
}
