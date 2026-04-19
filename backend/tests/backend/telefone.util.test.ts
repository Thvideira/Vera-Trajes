import { describe, expect, it } from "vitest";
import {
  limparTelefone,
  normalizarTelefoneParaBanco,
} from "../../src/utils/telefone.js";

describe("limparTelefone", () => {
  it("remove não dígitos", () => {
    expect(limparTelefone("(11) 98765-4321")).toBe("11987654321");
  });
});

describe("normalizarTelefoneParaBanco", () => {
  it("mantém DDD + 11 dígitos", () => {
    expect(normalizarTelefoneParaBanco("11987654321")).toBe("11987654321");
  });

  it("remove 55 inicial quando código do país", () => {
    expect(normalizarTelefoneParaBanco("5511987654321")).toBe("11987654321");
  });

  it("10 dígitos fixo", () => {
    expect(normalizarTelefoneParaBanco("1133334444")).toBe("1133334444");
  });
});
