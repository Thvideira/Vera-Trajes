export type TrajeTipo =
  | "VESTIDO"
  | "TERNO"
  | "SAPATO"
  | "GRAVATA"
  | "DAMINHA";

export type TrajeLocadoStatus =
  | "COSTUREIRA"
  | "LAVANDO"
  | "FALTA_PASSAR"
  | "PRONTO"
  | "RETIRADO"
  | "DEVOLUCAO_FEITA";

export type RetiradaStatus = "PENDENTE" | "PRONTO" | "RETIRADO";

export type AjusteTipo = "BARRA" | "CINTURA" | "COMPRIMENTO" | "OUTROS";

export type LavagemStatus = "PENDENTE" | "EM_ANDAMENTO" | "FEITO";

export const LABEL_TRAJE_TIPO: Record<TrajeTipo, string> = {
  VESTIDO: "Vestido",
  TERNO: "Terno",
  SAPATO: "Sapato",
  GRAVATA: "Gravata",
  DAMINHA: "Daminha",
};

export const LABEL_TRAJE_LOCADO_STATUS: Record<TrajeLocadoStatus, string> = {
  COSTUREIRA: "Costureira",
  LAVANDO: "Lavando",
  FALTA_PASSAR: "Falta passar",
  PRONTO: "Pronto",
  RETIRADO: "Retirado",
  DEVOLUCAO_FEITA: "Devolução feita",
};

export const LABEL_RETIRADA_STATUS: Record<RetiradaStatus, string> = {
  PENDENTE: "Pendente",
  PRONTO: "Pronto",
  RETIRADO: "Retirado",
};

export const LABEL_AJUSTE_TIPO: Record<AjusteTipo, string> = {
  BARRA: "Barra",
  CINTURA: "Cintura",
  COMPRIMENTO: "Comprimento",
  OUTROS: "Outros",
};

/**
 * `PRONTO` no banco com `precisaAjuste` ainda não significa “disponível para retirada”
 * (cadastro / antes de enviar à costureira). Nesse caso não exibimos o rótulo “Pronto”.
 */
export function trajeLocadoNaoProntoParaExibir(
  status: TrajeLocadoStatus,
  precisaAjuste: boolean | undefined
): boolean {
  return status === "PRONTO" && Boolean(precisaAjuste);
}

/** Etapa LAVANDO com lavagem ainda não iniciada na lavanderia (só encaminhar). */
export function trajeLocadoEncaminharLavanderia(
  status: TrajeLocadoStatus,
  precisaLavagem: boolean | undefined,
  lavagemStatus: string | undefined
): boolean {
  return (
    status === "LAVANDO" &&
    Boolean(precisaLavagem) &&
    lavagemStatus === "PENDENTE"
  );
}

/** Rótulo principal do traje (status + contexto de ajuste / lavagem). */
export function labelTrajeLocadoComContexto(
  status: TrajeLocadoStatus,
  precisaAjuste: boolean | undefined,
  precisaLavagem?: boolean,
  lavagemStatus?: string
): string {
  if (trajeLocadoNaoProntoParaExibir(status, precisaAjuste)) {
    return "Aguardando ajuste";
  }
  if (trajeLocadoEncaminharLavanderia(status, precisaLavagem, lavagemStatus)) {
    return "Encaminhe para a lavanderia";
  }
  return LABEL_TRAJE_LOCADO_STATUS[status];
}

/** Classes do badge principal (âmbar na fase “aguardando ajuste”, não verde “Pronto”). */
export function badgeClassTrajeLocadoComContexto(
  status: TrajeLocadoStatus,
  precisaAjuste: boolean | undefined,
  precisaLavagem?: boolean,
  lavagemStatus?: string
): string {
  if (trajeLocadoNaoProntoParaExibir(status, precisaAjuste)) {
    return "bg-amber-100 text-amber-950 border border-amber-200";
  }
  if (trajeLocadoEncaminharLavanderia(status, precisaLavagem, lavagemStatus)) {
    return "bg-slate-100 text-slate-800 border border-slate-300";
  }
  return badgeClassForTrajeStatus(status);
}

/**
 * Segundo badge “Ajuste pendente” só quando o status já é outro (ex.: Costureira),
 * para não duplicar informação com “Aguardando ajuste”.
 */
export function exibirSegundoBadgeAjustePendente(
  status: TrajeLocadoStatus,
  precisaAjuste: boolean | undefined
): boolean {
  return Boolean(precisaAjuste) && !trajeLocadoNaoProntoParaExibir(status, precisaAjuste);
}

/** Badge do status operacional do traje locado (fluxo sequencial). */
export function badgeClassForTrajeStatus(s: TrajeLocadoStatus): string {
  if (s === "COSTUREIRA") {
    return "bg-orange-100 text-orange-950 border border-orange-200";
  }
  if (s === "LAVANDO") {
    return "bg-sky-100 text-sky-950 border border-sky-200";
  }
  if (s === "FALTA_PASSAR") {
    return "bg-amber-100 text-amber-950 border border-amber-200";
  }
  if (s === "PRONTO") {
    return "bg-emerald-100 text-emerald-900 border border-emerald-200";
  }
  if (s === "RETIRADO") {
    return "bg-violet-100 text-violet-900 border border-violet-200";
  }
  if (s === "DEVOLUCAO_FEITA") {
    return "bg-slate-200 text-slate-800 border border-slate-300";
  }
  return "bg-slate-100 text-slate-800 border border-slate-200";
}

/** Indicador separado: ajuste pendente (ainda não enviado ou em fila de costura). */
export function badgeClassPrecisaAjuste(): string {
  return "bg-rose-50 text-rose-900 border border-rose-200";
}
