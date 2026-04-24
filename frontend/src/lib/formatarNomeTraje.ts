/**
 * Nome do traje: trim, minúsculas, só a primeira letra maiúscula na frase inteira.
 * Alinhado a `backend/src/utils/formatarNomeTraje.ts`.
 */
export function formatarNomeTraje(texto: string): string {
  if (!texto) return texto;
  const lower = texto.toLowerCase().trim();
  if (!lower) return "";
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
