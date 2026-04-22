/**
 * Sugestão de data/hora de retirada: evento − 2 dias (fuso local do navegador).
 * Se isso cair antes do dia do cadastro da locação, usa o dia do cadastro com o
 * mesmo horário do evento; se ainda for antes do instante de referência, usa o instante de referência.
 */

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function dateParaDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * @param dataEventoInput valor de `datetime-local` (YYYY-MM-DDTHH:mm)
 * @param referenciaAluguel instante de referência do “dia do aluguel” (ex.: `new Date()` ao abrir o formulário)
 */
export function sugerirDataRetiradaDatetimeLocal(
  dataEventoInput: string,
  referenciaAluguel: Date = new Date()
): string {
  const t = dataEventoInput.trim();
  if (!t) return "";
  const ev = new Date(t);
  if (Number.isNaN(ev.getTime())) return "";

  const doisAntes = new Date(ev);
  doisAntes.setDate(doisAntes.getDate() - 2);

  const diaAluguel = startOfLocalDay(referenciaAluguel);
  let result: Date;

  if (startOfLocalDay(doisAntes) < diaAluguel) {
    result = new Date(
      diaAluguel.getFullYear(),
      diaAluguel.getMonth(),
      diaAluguel.getDate(),
      ev.getHours(),
      ev.getMinutes(),
      0,
      0
    );
    if (result.getTime() < referenciaAluguel.getTime()) {
      result = new Date(referenciaAluguel.getTime());
    }
  } else {
    result = doisAntes;
  }

  return dateParaDatetimeLocal(result);
}
