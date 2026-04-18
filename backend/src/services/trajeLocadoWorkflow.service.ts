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
  precisaLavagem: boolean;
  lavagemStatus: LavagemStatus;
  ajustes: { status: AjusteStatus }[];
};

/** Recalcula status operacional (não altera RETIRADO/FINALIZADO). */
export function computeTrajeLocadoStatus(
  tl: TrajeLocadoComAjustes
): TrajeLocadoStatus {
  if (
    tl.status === TrajeLocadoStatus.RETIRADO ||
    tl.status === TrajeLocadoStatus.FINALIZADO
  ) {
    return tl.status;
  }

  const ajustes = tl.ajustes;
  const anyPend = ajustes.some((a) => a.status === AjusteStatus.PENDENTE);
  const allDone =
    ajustes.length === 0 ||
    ajustes.every((a) => a.status === AjusteStatus.CONCLUIDO);

  if (anyPend) {
    const anyOk = ajustes.some((a) => a.status === AjusteStatus.CONCLUIDO);
    return anyOk
      ? TrajeLocadoStatus.EM_AJUSTE
      : TrajeLocadoStatus.AGUARDANDO_AJUSTE;
  }

  if (!allDone) {
    return TrajeLocadoStatus.AGUARDANDO_AJUSTE;
  }

  if (!tl.precisaLavagem) {
    return TrajeLocadoStatus.PRONTO_RETIRADA;
  }

  if (tl.lavagemStatus === LavagemStatus.FEITO) {
    return TrajeLocadoStatus.PRONTO_RETIRADA;
  }

  if (tl.lavagemStatus === LavagemStatus.EM_ANDAMENTO) {
    return TrajeLocadoStatus.EM_LAVAGEM;
  }

  /* lavagem PENDENTE: costura concluída — aguardando encaminhar / fila de lavagem */
  if (tl.status === TrajeLocadoStatus.LAVAGEM_PENDENTE) {
    return TrajeLocadoStatus.LAVAGEM_PENDENTE;
  }

  return TrajeLocadoStatus.AJUSTADO;
}

export function podeSerProntoRetirada(tl: TrajeLocadoComAjustes): boolean {
  const allDone =
    tl.ajustes.length === 0 ||
    tl.ajustes.every((a) => a.status === AjusteStatus.CONCLUIDO);
  const lavOk = !tl.precisaLavagem || tl.lavagemStatus === LavagemStatus.FEITO;
  return allDone && lavOk;
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

  const next = computeTrajeLocadoStatus({
    id: tl.id,
    status: tl.status,
    precisaLavagem: tl.precisaLavagem,
    lavagemStatus: tl.lavagemStatus,
    ajustes: tl.ajustes.map((a) => ({ status: a.status })),
  });

  if (next !== tl.status) {
    await db.trajeLocado.update({
      where: { id: trajeLocadoId },
      data: { status: next },
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
    s === TrajeLocadoStatus.PRONTO_RETIRADA ||
    s === TrajeLocadoStatus.RETIRADO ||
    s === TrajeLocadoStatus.FINALIZADO;
  const isRetiradoOuFinal = (s: TrajeLocadoStatus) =>
    s === TrajeLocadoStatus.RETIRADO || s === TrajeLocadoStatus.FINALIZADO;

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
      "Só é possível marcar como pronto quando todos os ajustes estiverem concluídos e a lavagem estiver feita (ou não for necessária)"
    );
  }
}
