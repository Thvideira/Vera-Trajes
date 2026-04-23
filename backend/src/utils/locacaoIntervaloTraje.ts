/** Mantido alinhado a `frontend/src/lib/locacaoIntervaloTraje.ts` (mesma regra em tela). */
export const INTERVALO_MIN_DIAS_ENTRE_LOCACOES_TRAJE = 5;

export const MENSAGEM_INTERVALO_TRAJE_LOCACAO =
  "Este traje já possui uma locação próxima. É necessário um intervalo mínimo de 5 dias entre eventos.";

/**
 * Locações que ainda competem pelo traje (em aberto). Locações encerradas não entram na regra.
 */
export function locacaoAtivaParaIntervaloTraje(loc: { encerrada: boolean }): boolean {
  return !loc.encerrada;
}

export type LocacaoDatasParaIntervalo = {
  dataAluguel: Date;
  dataEvento: Date | null;
  dataDevolucaoPrevista: Date | null;
};

export function dataReferenciaLocacao(loc: LocacaoDatasParaIntervalo): Date {
  return loc.dataEvento ?? loc.dataAluguel;
}

export function inicioDiaUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function diferencaEmDiasCalendarioUtc(a: Date, b: Date): number {
  const ms = inicioDiaUtc(a).getTime() - inicioDiaUtc(b).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * |nova_ref − ref_existente| < minDias → viola (dias de calendário UTC).
 * Nova locação: ref. = data do evento (obrigatória na criação).
 * Locação já gravada: ref. = dataEvento ?? dataAluguel (legado sem evento).
 */
export function violaIntervaloMinimoEntreLocacoes(
  novaDataReferencia: Date,
  existente: LocacaoDatasParaIntervalo,
  minDias: number
): boolean {
  const nova = inicioDiaUtc(novaDataReferencia);
  const existStart = inicioDiaUtc(dataReferenciaLocacao(existente));

  return Math.abs(diferencaEmDiasCalendarioUtc(nova, existStart)) < minDias;
}

export function violaIntervaloParaAlgumaLocacao(
  novaDataReferencia: Date,
  existentes: LocacaoDatasParaIntervalo[],
  minDias: number = INTERVALO_MIN_DIAS_ENTRE_LOCACOES_TRAJE
): boolean {
  if (existentes.length === 0) return false;
  return existentes.some((e) =>
    violaIntervaloMinimoEntreLocacoes(novaDataReferencia, e, minDias)
  );
}
