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
