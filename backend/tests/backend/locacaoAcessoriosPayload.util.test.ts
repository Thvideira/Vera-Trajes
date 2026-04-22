import { describe, expect, it } from "vitest";
import { acessoriosPayloadParaItensDescritivos } from "../../src/utils/locacaoAcessoriosPayload.js";

describe("acessoriosPayloadParaItensDescritivos", () => {
  it("mapeia nome para descricao e mantém campos", () => {
    expect(
      acessoriosPayloadParaItensDescritivos([
        {
          nome: " Gravata ",
          quantidade: 2,
          variacao: "azul",
          observacao: null,
          separado: true,
        },
      ])
    ).toEqual([
      {
        descricao: "Gravata",
        quantidade: 2,
        variacao: "azul",
        observacao: null,
        separado: true,
      },
    ]);
  });
});
