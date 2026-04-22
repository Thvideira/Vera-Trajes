/**
 * Enriquece o JSON da locação para o cliente: garante lista de itens e aliases úteis.
 * Campo canônico no banco continua sendo `itensDescritivos` (descricao, quantidade, …).
 */
type ItemDesc = {
  id: string;
  descricao: string;
  quantidade?: number | null;
  variacao: string | null;
  observacao: string | null;
  separado?: boolean | null;
};

type ComItens = { itensDescritivos?: ItemDesc[] | null };

export function resumoAcessoriosLocacao(
  itens: ItemDesc[] | null | undefined
): string | null {
  const list = itens ?? [];
  if (list.length === 0) return null;
  const parts = list.map((i) => {
    const q = Math.max(1, i.quantidade ?? 1);
    const varTrim = (i.variacao ?? "").trim();
    const base = varTrim ? `${i.descricao} (${varTrim})` : i.descricao;
    return `${q}× ${base}`;
  });
  return `Acessórios: ${parts.join(", ")}`;
}

export function withAcessoriosPublicos<T extends ComItens>(loc: T) {
  const itens = loc.itensDescritivos ?? [];
  return {
    ...loc,
    itensDescritivos: itens,
    acessorios: itens.map((i) => ({
      id: i.id,
      nome: i.descricao,
      quantidade: i.quantidade ?? 1,
      variacao: i.variacao,
      observacao: i.observacao,
      separado: i.separado ?? false,
    })),
    resumoAcessorios: resumoAcessoriosLocacao(itens),
  };
}
