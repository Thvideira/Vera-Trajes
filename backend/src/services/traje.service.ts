import type { Prisma, TrajeTipo } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { formatarNomeTraje } from "../utils/formatarNomeTraje.js";
import { deleteTrajeImageIfLocal } from "./upload.service.js";

export async function listTrajes(filters: {
  q?: string;
  tipo?: TrajeTipo;
  status?: "DISPONIVEL" | "ALUGADO";
}) {
  const q = filters.q?.trim();
  return prisma.traje.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { nome: { contains: q, mode: "insensitive" } },
                { codigo: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        filters.tipo ? { tipo: filters.tipo } : {},
        filters.status ? { status: filters.status } : {},
      ],
    },
    orderBy: { codigo: "asc" },
  });
}

export async function getTraje(id: string) {
  const t = await prisma.traje.findUnique({ where: { id } });
  if (!t) throw new AppError(404, "Traje não encontrado");
  return t;
}

export async function createTraje(data: Prisma.TrajeCreateInput) {
  const codigo = data.codigo.trim().toLowerCase();
  const nome = formatarNomeTraje(String(data.nome));
  const exists = await prisma.traje.findUnique({ where: { codigo } });
  if (exists) throw new AppError(409, "Código já utilizado");
  return prisma.traje.create({
    data: { ...data, codigo, nome },
  });
}

export async function updateTraje(id: string, data: Prisma.TrajeUpdateInput) {
  await getTraje(id);
  if (typeof data.nome === "string") {
    data.nome = formatarNomeTraje(data.nome);
  }
  if (data.codigo && typeof data.codigo === "string") {
    const codigo = data.codigo.trim().toLowerCase();
    data.codigo = codigo;
    const clash = await prisma.traje.findFirst({
      where: { codigo, NOT: { id } },
    });
    if (clash) throw new AppError(409, "Código já utilizado");
  }
  return prisma.traje.update({ where: { id }, data });
}

export async function deleteTraje(id: string) {
  const t = await getTraje(id);
  const item = await prisma.trajeLocado.findFirst({ where: { trajeId: id } });
  if (item) {
    throw new AppError(
      400,
      "Este traje não pode ser excluído pois está vinculado a locações"
    );
  }
  await deleteTrajeImageIfLocal(t.fotoUrl);
  await prisma.traje.delete({ where: { id } });
}

export async function setTrajeFotoUrl(id: string, fotoUrl: string | null) {
  const t = await getTraje(id);
  if (fotoUrl === null) await deleteTrajeImageIfLocal(t.fotoUrl);
  return prisma.traje.update({
    where: { id },
    data: { fotoUrl },
  });
}
