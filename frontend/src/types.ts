export type TrajeTipo =
  | "VESTIDO"
  | "TERNO"
  | "SAPATO"
  | "GRAVATA"
  | "DAMINHA";

export type TrajeLocadoStatus =
  | "AGUARDANDO_AJUSTE"
  | "EM_AJUSTE"
  | "AJUSTADO"
  | "LAVAGEM_PENDENTE"
  | "EM_LAVAGEM"
  | "PRONTO_RETIRADA"
  | "RETIRADO"
  | "FINALIZADO";

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
  AGUARDANDO_AJUSTE: "Aguardando ajuste",
  EM_AJUSTE: "Em ajuste",
  AJUSTADO: "Ajustado",
  LAVAGEM_PENDENTE: "Lavagem / passador pendente",
  EM_LAVAGEM: "Em lavagem / preparação",
  PRONTO_RETIRADA: "Pronto para retirada",
  RETIRADO: "Retirado",
  FINALIZADO: "Finalizado",
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

/** Badges: pronto → verde; ajuste → âmbar; lavagem → laranja; encerrado → rosa/cinza */
export function badgeClassForTrajeStatus(s: TrajeLocadoStatus): string {
  if (s === "PRONTO_RETIRADA") return "bg-emerald-100 text-emerald-900";
  if (s === "RETIRADO" || s === "FINALIZADO")
    return "bg-[#FCE4EC] text-[#AD1457] border border-[#F8BBD0]";
  if (s === "EM_LAVAGEM") return "bg-orange-100 text-orange-900";
  if (s === "LAVAGEM_PENDENTE") return "bg-orange-50 text-orange-900 border border-orange-200";
  if (s === "EM_AJUSTE" || s === "AGUARDANDO_AJUSTE") return "bg-amber-100 text-amber-900";
  if (s === "AJUSTADO") return "bg-yellow-50 text-yellow-900 border border-yellow-200";
  return "bg-violet-100 text-violet-900";
}
