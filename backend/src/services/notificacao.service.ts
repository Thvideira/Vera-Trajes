import {
  NotificacaoTipo,
  PagamentoLocacaoStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { computeRemaining } from "./finance.service.js";
import { normalizeWhatsappPhone, sendWhatsappText } from "./whatsapp.service.js";

function fmtDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function dayKeySP(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function addDaysYMD(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export async function sendConfirmacaoAluguel(locacaoId: string): Promise<void> {
  const already = await prisma.notificacaoEnvio.findFirst({
    where: {
      locacaoId,
      tipo: NotificacaoTipo.CONFIRMACAO_ALUGUEL,
    },
  });
  if (already) return;

  const loc = await prisma.locacao.findUnique({
    where: { id: locacaoId },
    include: {
      cliente: true,
      retiradas: {
        include: { trajesLocados: { include: { traje: true } } },
        orderBy: { dataRetirada: "asc" },
      },
    },
  });
  if (!loc) return;

  const dataChave = new Date(`${dayKeySP(new Date())}T12:00:00.000Z`);

  const trajesNomes = [
    ...new Set(
      loc.retiradas.flatMap((r) => r.trajesLocados.map((tl) => tl.traje.nome))
    ),
  ].join(", ");

  const retiradasTxt = loc.retiradas
    .map(
      (r) =>
        `${fmtDate(r.dataRetirada)} (${r.trajesLocados.map((x) => x.traje.nome).join(", ")})`
    )
    .join(" | ");

  const body = [
    `Olá ${loc.cliente.nome}!`,
    ``,
    `Sua locação foi registrada.`,
    `Trajes: ${trajesNomes}`,
    `Retiradas: ${retiradasTxt}`,
    loc.dataEvento ? `Evento: ${fmtDate(loc.dataEvento)}` : null,
    ``,
    `Obrigado por escolher nossa loja!`,
  ]
    .filter(Boolean)
    .join("\n");

  const to = normalizeWhatsappPhone(loc.cliente.telefone);
  const result = await sendWhatsappText(to, body);

  try {
    await prisma.notificacaoEnvio.create({
      data: {
        locacaoId: loc.id,
        tipo: NotificacaoTipo.CONFIRMACAO_ALUGUEL,
        dataChave,
        sucesso: result.ok,
        detalheErro: result.error ?? null,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return;
    }
    throw e;
  }
}

export async function processScheduledNotifications(runDate: Date): Promise<void> {
  const todayKey = dayKeySP(runDate);
  const tomorrowKey = addDaysYMD(todayKey, 1);

  const locacoes = await prisma.locacao.findMany({
    where: {
      encerrada: false,
    },
    include: {
      cliente: true,
      retiradas: {
        include: { trajesLocados: { include: { traje: true } } },
        orderBy: { dataRetirada: "asc" },
      },
    },
  });

  for (const loc of locacoes) {
    const rem = computeRemaining(loc.valorTotal, loc.valorPago);
    const trajes = [
      ...new Set(
        loc.retiradas.flatMap((r) =>
          r.trajesLocados.map((tl) => tl.traje.nome)
        )
      ),
    ].join(", ");

    const temRetiradaAmanha = loc.retiradas.some(
      (r) => dayKeySP(r.dataRetirada) === tomorrowKey
    );
    if (temRetiradaAmanha) {
      const retTxt = loc.retiradas
        .filter((r) => dayKeySP(r.dataRetirada) === tomorrowKey)
        .map((r) => fmtDate(r.dataRetirada))
        .join(", ");
      await sendOnce(
        loc.id,
        NotificacaoTipo.LEMBRETE_RETIRADA,
        todayKey,
        loc.cliente.telefone,
        [
          `Olá ${loc.cliente.nome}!`,
          `Lembrete: amanhã há retirada agendada (${retTxt}).`,
          `Trajes: ${trajes}`,
        ].join("\n")
      );
    }

    if (
      loc.dataEvento &&
      dayKeySP(loc.dataEvento) === tomorrowKey
    ) {
      await sendOnce(
        loc.id,
        NotificacaoTipo.LEMBRETE_EVENTO,
        todayKey,
        loc.cliente.telefone,
        [
          `Olá ${loc.cliente.nome}!`,
          `Lembrete: seu evento é amanhã (${fmtDate(loc.dataEvento)}).`,
          `Trajes: ${trajes}`,
          `Tenha um ótimo evento!`,
        ].join("\n")
      );
    }

    if (
      loc.dataDevolucaoPrevista &&
      todayKey > dayKeySP(loc.dataDevolucaoPrevista)
    ) {
      await sendOnce(
        loc.id,
        NotificacaoTipo.ATRASO_DEVOLUCAO,
        todayKey,
        loc.cliente.telefone,
        [
          `Olá ${loc.cliente.nome}.`,
          `Identificamos atraso na devolução dos trajes (${trajes}).`,
          `Por favor entre em contato conosco.`,
        ].join("\n")
      );
    }

    if (rem.gt(0) && loc.statusPagamento !== PagamentoLocacaoStatus.PAGO) {
      await sendOnce(
        loc.id,
        NotificacaoTipo.PAGAMENTO_PENDENTE,
        todayKey,
        loc.cliente.telefone,
        [
          `Olá ${loc.cliente.nome}.`,
          `Há valor pendente na sua locação: R$ ${rem.toFixed(2)}.`,
          `Trajes: ${trajes}`,
          `Qualquer dúvida, fale conosco.`,
        ].join("\n")
      );
    }
  }
}

async function sendOnce(
  locacaoId: string,
  tipo: NotificacaoTipo,
  dataChaveStr: string,
  telefone: string,
  body: string
): Promise<void> {
  const dataChave = new Date(`${dataChaveStr}T12:00:00.000Z`);

  const existing = await prisma.notificacaoEnvio.findFirst({
    where: { locacaoId, tipo, dataChave },
  });
  if (existing) return;

  const result = await sendWhatsappText(normalizeWhatsappPhone(telefone), body);

  try {
    await prisma.notificacaoEnvio.create({
      data: {
        locacaoId,
        tipo,
        dataChave,
        sucesso: result.ok,
        detalheErro: result.error ?? null,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return;
    }
    throw e;
  }
}
