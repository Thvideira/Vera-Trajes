import { AjusteStatus, AjusteTipo } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import {
  recomputeTrajeLocado,
  syncRetiradaStatus,
} from "./trajeLocadoWorkflow.service.js";

export async function listPendentes() {
  return prisma.ajuste.findMany({
    where: { status: AjusteStatus.PENDENTE },
    include: {
      trajeLocado: {
        include: {
          traje: true,
          retirada: {
            include: {
              locacao: { include: { cliente: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function addAjuste(
  trajeLocadoId: string,
  data: { tipo: AjusteTipo; descricao?: string }
) {
  const tl = await prisma.trajeLocado.findUnique({
    where: { id: trajeLocadoId },
    include: { retirada: { include: { locacao: true } } },
  });
  if (!tl) throw new AppError(404, "Traje locado não encontrado");
  if (tl.retirada.locacao.encerrada) {
    throw new AppError(400, "Locação encerrada");
  }

  const created = await prisma.ajuste.create({
    data: {
      trajeLocadoId,
      tipo: data.tipo,
      descricao: data.descricao ?? null,
      status: AjusteStatus.PENDENTE,
    },
    include: {
      trajeLocado: {
        include: {
          traje: true,
          retirada: {
            include: { locacao: { include: { cliente: true } } },
          },
        },
      },
    },
  });

  await recomputeTrajeLocado(prisma, trajeLocadoId);
  await syncRetiradaStatus(prisma, tl.retiradaId);
  return created;
}

export async function updateAjusteStatus(id: string, status: AjusteStatus) {
  const a = await prisma.ajuste.findUnique({
    where: { id },
    include: { trajeLocado: true },
  });
  if (!a) throw new AppError(404, "Ajuste não encontrado");

  const updated = await prisma.ajuste.update({
    where: { id },
    data: { status },
    include: {
      trajeLocado: {
        include: {
          traje: true,
          retirada: { include: { locacao: true } },
        },
      },
    },
  });

  await recomputeTrajeLocado(prisma, a.trajeLocadoId);
  await syncRetiradaStatus(prisma, a.trajeLocado.retiradaId);
  return updated;
}
