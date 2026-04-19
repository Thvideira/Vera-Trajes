/** Mantém apenas os dígitos do CPF (envio à API / estado interno). */
export function limparCPF(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

/**
 * Exibe CPF no padrão 000.000.000-00.
 * Durante a digitação, aplica máscara parcial para até 11 dígitos.
 */
export function formatarCPF(cpf: string): string {
  const d = limparCPF(cpf).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}
