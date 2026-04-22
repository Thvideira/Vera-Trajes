/** Uma linha legível (sempre com quantidade explícita: "1× Gravata"). */
export function formatarResumoAcessoriosLocacao(
  items: { descricao: string; variacao: string | null; quantidade?: number }[]
): string | null {
  if (!items?.length) return null;
  const parts = items.map((i) => {
    const q = Math.max(1, i.quantidade ?? 1);
    const label = i.variacao?.trim()
      ? `${i.descricao} (${i.variacao.trim()})`
      : i.descricao;
    return `${q}× ${label}`;
  });
  return `Acessórios: ${parts.join(", ")}`;
}

/** Prefixo de `id` gerado no cliente quando a API não envia `id` (não chamar PATCH por item). */
const ID_LOCAL_PREFIX = "__local-";

export function isAcessorioIdPersistidoNoServidor(id: string | undefined): boolean {
  return Boolean(id && !id.startsWith(ID_LOCAL_PREFIX));
}

/** Normaliza `separado` vindo de JSON/Prisma (evita `Boolean("false") === true`). */
export function parseSeparadoValor(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v === null || v === undefined) return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "sim" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "nao" || s === "não" || s === "no" || s === "") return false;
  }
  return Boolean(v);
}

function pickDescritivosOuAcessoriosArray(row: Record<string, unknown>): unknown[] {
  const fromItens = row.itensDescritivos;
  const fromItensSnake = row.itens_descritivos;
  const fromAcc = row.acessorios;

  const itensArr = Array.isArray(fromItens)
    ? fromItens
    : Array.isArray(fromItensSnake)
      ? fromItensSnake
      : [];
  const accArr = Array.isArray(fromAcc) ? fromAcc : [];

  if (itensArr.length > 0) return itensArr;
  if (accArr.length > 0) return accArr;
  return itensArr;
}

/**
 * Garante lista vinda do GET/PATCH: aceita `itensDescritivos` ou alias `acessorios` (campo `nome`).
 * — Se `itensDescritivos` for `[]` mas `acessorios` tiver linhas, usa `acessorios`.
 * — Não exige `id`: linhas só com nome/descrição passam (id sintético `__local-n` só para UI/chave).
 */
export function coalesceItensDescritivosFromLocacao(row: Record<string, unknown>): {
  id: string;
  descricao: string;
  quantidade: number;
  variacao: string | null;
  observacao: string | null;
  separado: boolean;
}[] {
  const arr = pickDescritivosOuAcessoriosArray(row);
  const out: {
    id: string;
    descricao: string;
    quantidade: number;
    variacao: string | null;
    observacao: string | null;
    separado: boolean;
  }[] = [];
  let slot = 0;
  for (const raw of arr) {
    if (typeof raw !== "object" || raw === null) continue;
    const x = raw as Record<string, unknown>;
    const idRaw = x.id;
    const idTrim =
      idRaw != null && String(idRaw).trim() !== "" ? String(idRaw).trim() : "";
    const desc = x.descricao ?? x.nome;
    const descStr = String(desc ?? "").trim();
    if (!descStr) continue;
    const id = idTrim || `${ID_LOCAL_PREFIX}${slot++}`;
    const separadoRaw =
      x.separado !== undefined && x.separado !== null
        ? x.separado
        : x.separado_entrega;
    out.push({
      id,
      descricao: descStr,
      quantidade: Math.max(1, Math.floor(Number(x.quantidade)) || 1),
      variacao:
        x.variacao != null && String(x.variacao).trim() !== ""
          ? String(x.variacao)
          : null,
      observacao:
        x.observacao != null && String(x.observacao).trim() !== ""
          ? String(x.observacao)
          : null,
      separado: parseSeparadoValor(separadoRaw),
    });
  }
  return out;
}
