/**
 * Espelha a regra do frontend em UTC (servidor): piso da retirada =
 * max(início do dia UTC do "agora", evento − 2 dias em calendário UTC);
 * se o piso com hora do evento ainda for &lt; agora, usa `agora`.
 * Usado só para garantir piso mínimo na criação da locação (não sobrescreve datas posteriores).
 */

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function subUtcDays(d: Date, days: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() - days);
  return x;
}

/** Data/hora mínima sugerida (piso) para retirada na criação, alinhada à regra evento − 2 dias. */
export function dataRetiradaMinimaNaCriacaoUtc(dataEvento: Date, agora: Date): Date {
  const doisAntes = subUtcDays(dataEvento, 2);
  const diaAluguelUtc = startOfUtcDay(agora);

  let result: Date;
  if (startOfUtcDay(doisAntes) < diaAluguelUtc) {
    result = new Date(
      Date.UTC(
        diaAluguelUtc.getUTCFullYear(),
        diaAluguelUtc.getUTCMonth(),
        diaAluguelUtc.getUTCDate(),
        dataEvento.getUTCHours(),
        dataEvento.getUTCMinutes(),
        0,
        0
      )
    );
    if (result.getTime() < agora.getTime()) {
      result = new Date(agora.getTime());
    }
  } else {
    result = doisAntes;
  }

  return result;
}

/** Garante `dataRetirada` não anterior ao piso da regra (ajuste suave, não rejeita). */
export function clampDataRetiradaCriacaoUtc(
  dataRetirada: Date,
  dataEvento: Date,
  agora: Date
): Date {
  const minimo = dataRetiradaMinimaNaCriacaoUtc(dataEvento, agora);
  return dataRetirada.getTime() < minimo.getTime() ? minimo : dataRetirada;
}
