/** Uma linha legível para listagem / resumo do aluguel (ex.: "2× Gravata, Cinto"). */
export function formatarResumoAcessoriosLocacao(
  items: { descricao: string; variacao: string | null; quantidade?: number }[]
): string | null {
  if (!items?.length) return null;
  const parts = items.map((i) => {
    const q = Math.max(1, i.quantidade ?? 1);
    const label = i.variacao?.trim()
      ? `${i.descricao} (${i.variacao.trim()})`
      : i.descricao;
    return q > 1 ? `${q}× ${label}` : label;
  });
  return `Acessórios: ${parts.join(", ")}`;
}
