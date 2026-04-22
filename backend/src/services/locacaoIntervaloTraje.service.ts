import type { PrismaClient } from "@prisma/client";
import { LocacaoStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import {
  INTERVALO_MIN_DIAS_ENTRE_LOCACOES_TRAJE,
  MENSAGEM_INTERVALO_TRAJE_LOCACAO,
  type LocacaoDatasParaIntervalo,
  violaIntervaloParaAlgumaLocacao,
} from "../utils/locacaoIntervaloTraje.js";

/**
 * Locações ativas (em aberto) que já usam este traje.
 * Locações encerradas não entram na regra de intervalo — o traje já não está comprometido por elas.
 */
export async function listarDatasLocacoesPorTraje(
  db: Pick<PrismaClient, "trajeLocado">,
  trajeId: string,
  excludeLocacaoId?: string
): Promise<LocacaoDatasParaIntervalo[]> {
  const rows = await db.trajeLocado.findMany({
    where: {
      trajeId,
      retirada: {
        locacao: {
          encerrada: false,
          statusLocacao: LocacaoStatus.ATIVA,
          ...(excludeLocacaoId ? { id: { not: excludeLocacaoId } } : {}),
        },
      },
    },
    select: {
      retirada: {
        select: {
          locacao: {
            select: {
              id: true,
              dataAluguel: true,
              dataEvento: true,
              dataDevolucaoPrevista: true,
            },
          },
        },
      },
    },
  });

  const map = new Map<string, LocacaoDatasParaIntervalo>();
  for (const row of rows) {
    const l = row.retirada.locacao;
    if (!map.has(l.id)) {
      map.set(l.id, {
        dataAluguel: l.dataAluguel,
        dataEvento: l.dataEvento,
        dataDevolucaoPrevista: l.dataDevolucaoPrevista,
      });
    }
  }
  return [...map.values()];
}

export async function assertTrajeIntervaloMinimoLocacoes(
  trajeId: string,
  dataInicio: Date,
  opts?: { excludeLocacaoId?: string; db?: Pick<PrismaClient, "trajeLocado"> }
): Promise<void> {
  const db = opts?.db ?? prisma;
  const existentes = await listarDatasLocacoesPorTraje(
    db,
    trajeId,
    opts?.excludeLocacaoId
  );
  if (existentes.length === 0) {
    return;
  }
  if (
    violaIntervaloParaAlgumaLocacao(
      dataInicio,
      existentes,
      INTERVALO_MIN_DIAS_ENTRE_LOCACOES_TRAJE
    )
  ) {
    throw new AppError(400, MENSAGEM_INTERVALO_TRAJE_LOCACAO);
  }
}

export type ValidarIntervaloTrajesInput = {
  dataInicio: Date;
  trajeIds: string[];
  excludeLocacaoId?: string;
};

export async function validarIntervaloTrajesLocacao(
  input: ValidarIntervaloTrajesInput
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ids = [...new Set(input.trajeIds.map((s) => s.trim()).filter(Boolean))];
  if (ids.length === 0) return { ok: true };
  for (const tid of ids) {
    try {
      await assertTrajeIntervaloMinimoLocacoes(tid, input.dataInicio, {
        excludeLocacaoId: input.excludeLocacaoId,
      });
    } catch (e) {
      if (e instanceof AppError && e.statusCode === 400) {
        return { ok: false, message: e.message };
      }
      throw e;
    }
  }
  return { ok: true };
}
