/**
 * A partir da data do evento, obtém o intervalo [sáb 00:00 UTC, dom 23:59:59.999 UTC]
 * do final de semana correspondente.
 * - Sábado/Domingo: o par sáb–dom que contém a data.
 * - Segunda a sexta: o próximo sábado e o domingo seguinte.
 */
export function weekendRangeUtcFromEventDate(dataEvento: Date): {
  gte: Date;
  lte: Date;
} {
  if (Number.isNaN(dataEvento.getTime())) {
    throw new Error("Data de evento inválida");
  }
  const base = new Date(
    Date.UTC(
      dataEvento.getUTCFullYear(),
      dataEvento.getUTCMonth(),
      dataEvento.getUTCDate()
    )
  );
  const day = base.getUTCDay(); // 0 dom … 6 sáb

  const sat = new Date(base);
  if (day === 0) {
    sat.setUTCDate(sat.getUTCDate() - 1);
  } else if (day < 6) {
    sat.setUTCDate(sat.getUTCDate() + (6 - day));
  }
  sat.setUTCHours(0, 0, 0, 0);

  const sun = new Date(sat);
  sun.setUTCDate(sun.getUTCDate() + 1);
  sun.setUTCHours(23, 59, 59, 999);

  return { gte: sat, lte: sun };
}
