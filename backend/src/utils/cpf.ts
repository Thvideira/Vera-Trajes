/** Mantém apenas os dígitos do CPF (para persistência no banco). */
export function limparCPF(cpf: string): string {
  return cpf.replace(/\D/g, "");
}
