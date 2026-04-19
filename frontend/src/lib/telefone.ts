/** Remove caracteres não numéricos. */
export function limparTelefone(tel: string): string {
  return tel.replace(/\D/g, "");
}

/**
 * Mesma regra do backend: dígitos nacionais; remove 55 se vier código do país.
 */
export function normalizarTelefoneDigitos(tel: string): string {
  let d = limparTelefone(tel);
  if (d.startsWith("55") && d.length >= 12) {
    d = d.slice(2);
  }
  return d.slice(0, 11);
}

/**
 * Exibição no padrão brasileiro: (DD) 99999-9999 ou (DD) 9999-9999.
 * Alinhado a `backend/src/utils/telefone.ts` para armazenamento.
 */
export function formatarTelefone(tel: string): string {
  const d = limparTelefone(tel).slice(0, 11);
  if (!d.length) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length === 10) {
    return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  if (d.length === 11) {
    return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  const dd = d.slice(0, 2);
  const r = d.slice(2);
  return `(${dd}) ${r.slice(0, 5)}-${r.slice(5)}`;
}
