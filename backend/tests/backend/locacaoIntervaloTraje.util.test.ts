import { describe, expect, it } from "vitest";
import {
  INTERVALO_MIN_DIAS_ENTRE_LOCACOES_TRAJE,
  violaIntervaloMinimoEntreLocacoes,
  violaIntervaloParaAlgumaLocacao,
} from "../../src/utils/locacaoIntervaloTraje.js";

function d(ymd: string): Date {
  const [y, m, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
}

describe("locacaoIntervaloTraje (dias de calendário UTC)", () => {
  const min = INTERVALO_MIN_DIAS_ENTRE_LOCACOES_TRAJE;

  it("bloqueia nova locação a 2 dias da existente (só data de início)", () => {
    const existente = {
      dataAluguel: d("2026-04-10"),
      dataEvento: null,
      dataDevolucaoPrevista: null,
    };
    expect(
      violaIntervaloMinimoEntreLocacoes(d("2026-04-12"), existente, min)
    ).toBe(true);
  });

  it("bloqueia a 4 dias", () => {
    const existente = {
      dataAluguel: d("2026-04-10"),
      dataEvento: null,
      dataDevolucaoPrevista: null,
    };
    expect(
      violaIntervaloMinimoEntreLocacoes(d("2026-04-14"), existente, min)
    ).toBe(true);
  });

  it("permite a 5 dias (diferença absoluta = 5)", () => {
    const existente = {
      dataAluguel: d("2026-04-10"),
      dataEvento: null,
      dataDevolucaoPrevista: null,
    };
    expect(
      violaIntervaloMinimoEntreLocacoes(d("2026-04-15"), existente, min)
    ).toBe(false);
  });

  it("considera datas anteriores (nova antes da existente)", () => {
    const existente = {
      dataAluguel: d("2026-04-20"),
      dataEvento: null,
      dataDevolucaoPrevista: null,
    };
    expect(
      violaIntervaloMinimoEntreLocacoes(d("2026-04-17"), existente, min)
    ).toBe(true);
    expect(
      violaIntervaloMinimoEntreLocacoes(d("2026-04-15"), existente, min)
    ).toBe(false);
  });

  it("usa dataEvento como referência da locação existente", () => {
    const existente = {
      dataAluguel: d("2026-01-01"),
      dataEvento: d("2026-04-10"),
      dataDevolucaoPrevista: null,
    };
    expect(
      violaIntervaloMinimoEntreLocacoes(d("2026-04-12"), existente, min)
    ).toBe(true);
  });

  it("violates se qualquer locação da lista conflita", () => {
    const a = {
      dataAluguel: d("2026-06-01"),
      dataEvento: null,
      dataDevolucaoPrevista: null,
    };
    const b = {
      dataAluguel: d("2026-12-01"),
      dataEvento: null,
      dataDevolucaoPrevista: null,
    };
    expect(violaIntervaloParaAlgumaLocacao(d("2026-06-03"), [a, b], min)).toBe(
      true
    );
    expect(violaIntervaloParaAlgumaLocacao(d("2026-06-10"), [a, b], min)).toBe(
      false
    );
  });
});
