import { describe, expect, it } from "vitest";
import { formatarNomeTraje } from "../../src/utils/formatarNomeTraje.js";

describe("formatarNomeTraje", () => {
  it("só a primeira letra da frase em maiúscula", () => {
    expect(formatarNomeTraje("VESTIDO AZUL")).toBe("Vestido azul");
    expect(formatarNomeTraje("veStIdo PRETO")).toBe("Vestido preto");
  });

  it("trim e vazio", () => {
    expect(formatarNomeTraje("  um  ")).toBe("Um");
    expect(formatarNomeTraje("")).toBe("");
    expect(formatarNomeTraje("   ")).toBe("");
  });
});
