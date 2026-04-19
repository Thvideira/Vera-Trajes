import { limparCPF } from "./cpf.js";

/** `trim` + lowercase para comparação de nome. */
export function normalizarTermoBuscaClientes(q: string | undefined): string {
  if (q == null) return "";
  return q.trim().toLowerCase();
}

/**
 * Regra de filtro: se o termo contém algum dígito, busca apenas no CPF (só dígitos);
 * caso contrário, busca apenas no nome (case-insensitive).
 */
export function clienteCorrespondeBusca(
  termoBruto: string | undefined,
  nome: string,
  cpf: string
): boolean {
  const termo = normalizarTermoBuscaClientes(termoBruto);
  if (!termo) return true;

  const buscaNumerica = termo.replace(/\D/g, "");
  if (buscaNumerica.length > 0) {
    return limparCPF(cpf).includes(buscaNumerica);
  }

  return nome.toLowerCase().includes(termo);
}
