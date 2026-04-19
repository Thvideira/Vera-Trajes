/** Preposições que permanecem em minúsculas no meio do nome (padrão brasileiro). */
const PREPOSICOES = new Set(["da", "de", "do", "dos", "das"]);

/**
 * Normaliza nome próprio: trim, colapsa espaços, capitaliza palavras exceto preposições comuns.
 */
export function formatarNome(nome: string): string {
  const s = nome.trim().toLowerCase();
  if (!s) return "";
  return s
    .split(/\s+/)
    .map((p) =>
      PREPOSICOES.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)
    )
    .join(" ");
}
