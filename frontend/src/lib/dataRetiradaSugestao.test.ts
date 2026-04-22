import { describe, expect, it } from "vitest";
import { startOfLocalDay, sugerirDataRetiradaDatetimeLocal } from "./dataRetiradaSugestao";

describe("sugerirDataRetiradaDatetimeLocal", () => {
  it("retira 2 dias do evento quando cabe no calendário após o dia do aluguel", () => {
    const ref = new Date(2026, 4, 1, 10, 0, 0);
    expect(sugerirDataRetiradaDatetimeLocal("2026-05-05T15:30", ref)).toBe(
      "2026-05-03T15:30"
    );
  });

  it("quando evento−2 cai antes do dia do cadastro, usa o dia do cadastro com hora do evento", () => {
    const ref = new Date(2026, 4, 1, 10, 0, 0);
    expect(sugerirDataRetiradaDatetimeLocal("2026-05-02T14:00", ref)).toBe(
      "2026-05-01T14:00"
    );
  });

  it("se ainda assim for antes do instante de referência, usa o instante de referência", () => {
    const ref = new Date(2026, 4, 1, 22, 0, 0);
    expect(sugerirDataRetiradaDatetimeLocal("2026-05-02T14:00", ref)).toBe(
      "2026-05-01T22:00"
    );
  });

  it("retorna vazio para evento inválido ou vazio", () => {
    expect(sugerirDataRetiradaDatetimeLocal("", new Date())).toBe("");
    expect(sugerirDataRetiradaDatetimeLocal("  ", new Date())).toBe("");
    expect(sugerirDataRetiradaDatetimeLocal("não-é-data", new Date())).toBe("");
  });
});

describe("startOfLocalDay", () => {
  it("zera horário", () => {
    const d = new Date(2026, 5, 15, 18, 30, 45);
    const s = startOfLocalDay(d);
    expect(s.getHours()).toBe(0);
    expect(s.getMinutes()).toBe(0);
    expect(s.getDate()).toBe(15);
  });
});
