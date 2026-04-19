import { describe, expect, it } from "vitest";
import { formatarNome } from "../../src/utils/formatarNome.js";

describe("formatarNome", () => {
  it("capitaliza palavras simples", () => {
    expect(formatarNome("joão silva")).toBe("João Silva");
  });

  it("mantém preposições em minúsculas", () => {
    expect(formatarNome("JOÃO DA SILVA")).toBe("João da Silva");
    expect(formatarNome("jOãO   dA   sIlVa")).toBe("João da Silva");
  });

  it("trim e espaços extras", () => {
    expect(formatarNome("  maria  costa  ")).toBe("Maria Costa");
  });

  it("string vazia", () => {
    expect(formatarNome("")).toBe("");
    expect(formatarNome("   ")).toBe("");
  });
});
