/**
 * Nome do traje: trim, minúsculas, só a primeira letra maiúscula na frase inteira.
 * Ex.: "VESTIDO AZUL" → "Vestido azul"
 */
export function formatarNomeTraje(texto: string): string {
  if (!texto) return texto;
  const lower = texto.toLowerCase().trim();
  if (!lower) return "";
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
