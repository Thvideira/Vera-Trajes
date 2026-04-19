import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { limparCPF } from "../utils/cpf.js";
import { formatarNome } from "../utils/formatarNome.js";
import { normalizarTelefoneParaBanco } from "../utils/telefone.js";

export async function listClientes(filters: { q?: string }) {
  const q = filters.q?.trim();
  return prisma.cliente.findMany({
    where: q
      ? {
          OR: [
            { nome: { contains: q, mode: "insensitive" } },
            { cpf: { contains: q.replace(/\D/g, "") } },
          ],
        }
      : undefined,
    orderBy: { nome: "asc" },
  });
}

export async function getCliente(id: string) {
  const c = await prisma.cliente.findUnique({ where: { id } });
  if (!c) throw new AppError(404, "Cliente não encontrado");
  return c;
}

export async function createCliente(data: Prisma.ClienteCreateInput) {
  const cpf = limparCPF(data.cpf);
  const exists = await prisma.cliente.findUnique({ where: { cpf } });
  if (exists) throw new AppError(409, "CPF já cadastrado");
  return prisma.cliente.create({
    data: {
      ...data,
      cpf,
      nome: formatarNome(String(data.nome)),
      telefone: normalizarTelefoneParaBanco(String(data.telefone)),
    },
  });
}

export async function updateCliente(id: string, data: Prisma.ClienteUpdateInput) {
  await getCliente(id);
  const payload: Prisma.ClienteUpdateInput = { ...data };
  if (typeof payload.nome === "string") {
    payload.nome = formatarNome(payload.nome);
  }
  if (typeof payload.telefone === "string") {
    payload.telefone = normalizarTelefoneParaBanco(payload.telefone);
  }
  if (payload.cpf && typeof payload.cpf === "string") {
    payload.cpf = limparCPF(payload.cpf);
    const clash = await prisma.cliente.findFirst({
      where: { cpf: payload.cpf as string, NOT: { id } },
    });
    if (clash) throw new AppError(409, "CPF já cadastrado");
  }
  return prisma.cliente.update({ where: { id }, data: payload });
}

export async function deleteCliente(id: string) {
  await getCliente(id);
  const loc = await prisma.locacao.findFirst({ where: { clienteId: id } });
  if (loc) throw new AppError(400, "Cliente possui locações vinculadas");
  await prisma.cliente.delete({ where: { id } });
}
