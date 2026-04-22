export type TrajeTipo =
  | "VESTIDO"
  | "TERNO"
  | "SAPATO"
  | "DAMINHA"
  | "CALCA";

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
  DAMINHA: "Daminha",
  CALCA: "Calça",
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
    return "Encaminhe à lavanderia";
  }
  return LABEL_TRAJE_LOCADO_STATUS[status];
}

/** Classes do badge principal (alerta na fase “aguardando ajuste”, não verde “Pronto”). */
export function badgeClassTrajeLocadoComContexto(
  status: TrajeLocadoStatus,
  precisaAjuste: boolean | undefined,
  precisaLavagem?: boolean,
  lavagemStatus?: string
): string {
  if (trajeLocadoNaoProntoParaExibir(status, precisaAjuste)) {
    return "status-warning";
  }
  if (trajeLocadoEncaminharLavanderia(status, precisaLavagem, lavagemStatus)) {
    return "status-pill-neutral";
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
    return "status-warning";
  }
  if (s === "LAVANDO") {
    return "status-info";
  }
  if (s === "FALTA_PASSAR") {
    return "status-warning";
  }
  if (s === "PRONTO") {
    return "status-success";
  }
  if (s === "RETIRADO") {
    return "status-pill-picked";
  }
  if (s === "DEVOLUCAO_FEITA") {
    return "status-pill-done";
  }
  return "status-pill-neutral";
}

/** Indicador separado: ajuste pendente (ainda não enviado ou em fila de costura). */
export function badgeClassPrecisaAjuste(): string {
  return "rounded-full border border-primary-light bg-pink-soft px-2 py-0.5 text-xs font-medium text-primary-hover";
}
