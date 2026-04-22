import { describe, expect, it } from "vitest";
import { normalizarItensDescritivos } from "../../src/services/locacao.service.js";

describe("normalizarItensDescritivos", () => {
  it("descarta linhas sem descrição e normaliza opcionais", () => {
    expect(
      normalizarItensDescritivos([
        { descricao: "  Gravata  ", variacao: " azul ", observacao: null },
        { descricao: "", variacao: "x" },
        { descricao: "Cinto", variacao: "", observacao: "  " },
      ])
    ).toEqual([
      { descricao: "Gravata", variacao: "azul", observacao: null },
      { descricao: "Cinto", variacao: null, observacao: null },
    ]);
  });

  it("retorna vazio para undefined ou array vazio", () => {
    expect(normalizarItensDescritivos(undefined)).toEqual([]);
    expect(normalizarItensDescritivos([])).toEqual([]);
  });
});
