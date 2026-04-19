/** Remove caracteres não numéricos. */
export function limparTelefone(tel: string): string {
  return tel.replace(/\D/g, "");
}

/**
 * Normaliza para armazenamento: só dígitos, DDD + número (10 ou 11 dígitos).
 * Se vier com código do país (55…), remove o 55 inicial.
 */
export function normalizarTelefoneParaBanco(tel: string): string {
  let d = limparTelefone(tel);
  if (d.startsWith("55") && d.length >= 12) {
    d = d.slice(2);
  }
  return d.slice(0, 11);
}
