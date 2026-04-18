import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function registrarHistorico(
  locacaoId: string,
  acao: string,
  detalhe?: Prisma.InputJsonValue
): Promise<void> {
  await prisma.locacaoHistorico.create({
    data: {
      locacaoId,
      acao,
      detalhe: detalhe ?? undefined,
    },
  });
}
