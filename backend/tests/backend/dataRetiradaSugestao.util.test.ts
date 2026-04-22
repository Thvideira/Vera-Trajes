import { describe, expect, it } from "vitest";
import {
  clampDataRetiradaCriacaoUtc,
  dataRetiradaMinimaNaCriacaoUtc,
} from "../../src/utils/dataRetiradaSugestao.js";

describe("dataRetiradaMinimaNaCriacaoUtc", () => {
  it("evento menos 2 dias quando não viola o dia do cadastro (UTC)", () => {
    const agora = new Date(Date.UTC(2026, 4, 1, 12, 0, 0));
    const evento = new Date(Date.UTC(2026, 4, 5, 15, 30, 0));
    const min = dataRetiradaMinimaNaCriacaoUtc(evento, agora);
    expect(min.toISOString()).toContain("2026-05-03");
  });
});

describe("clampDataRetiradaCriacaoUtc", () => {
  it("mantém data do cliente se já respeita o piso", () => {
    const agora = new Date(Date.UTC(2026, 4, 1, 12, 0, 0));
    const evento = new Date(Date.UTC(2026, 4, 10, 12, 0, 0));
    const pedido = new Date(Date.UTC(2026, 4, 9, 9, 0, 0));
    const out = clampDataRetiradaCriacaoUtc(pedido, evento, agora);
    expect(out.getTime()).toBe(pedido.getTime());
  });

  it("eleva data do cliente se estiver antes do piso", () => {
    const agora = new Date(Date.UTC(2026, 4, 1, 12, 0, 0));
    const evento = new Date(Date.UTC(2026, 4, 5, 15, 0, 0));
    const pedido = new Date(Date.UTC(2026, 4, 1, 8, 0, 0));
    const out = clampDataRetiradaCriacaoUtc(pedido, evento, agora);
    const min = dataRetiradaMinimaNaCriacaoUtc(evento, agora);
    expect(out.getTime()).toBe(min.getTime());
  });
});
