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
      {
        descricao: "Gravata",
        quantidade: 1,
        variacao: "azul",
        observacao: null,
        separado: false,
      },
      {
        descricao: "Cinto",
        quantidade: 1,
        variacao: null,
        observacao: null,
        separado: false,
      },
    ]);
  });

  it("retorna vazio para undefined ou array vazio", () => {
    expect(normalizarItensDescritivos(undefined)).toEqual([]);
    expect(normalizarItensDescritivos([])).toEqual([]);
  });

  it("normaliza quantidade e separado", () => {
    expect(
      normalizarItensDescritivos([
        {
          descricao: "Gravata",
          quantidade: 2,
          variacao: null,
          observacao: null,
          separado: true,
        },
        { descricao: "X", quantidade: 0, separado: false },
      ])
    ).toEqual([
      {
        descricao: "Gravata",
        quantidade: 2,
        variacao: null,
        observacao: null,
        separado: true,
      },
      {
        descricao: "X",
        quantidade: 1,
        variacao: null,
        observacao: null,
        separado: false,
      },
    ]);
  });
});
