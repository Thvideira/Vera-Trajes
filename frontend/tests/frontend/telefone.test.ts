import { describe, expect, it } from "vitest";
import { formatarTelefone, limparTelefone } from "../../src/lib/telefone";

describe("formatarTelefone", () => {
  it("11 dígitos celular", () => {
    expect(formatarTelefone("11987654321")).toBe("(11) 98765-4321");
  });

  it("10 dígitos fixo", () => {
    expect(formatarTelefone("1133334444")).toBe("(11) 3333-4444");
  });

  it("com máscara na entrada", () => {
    expect(formatarTelefone("(11) 98765-4321")).toBe("(11) 98765-4321");
  });
});

describe("limparTelefone", () => {
  it("só dígitos", () => {
    expect(limparTelefone("+55 (11) 98765-4321")).toBe("5511987654321");
  });
});
