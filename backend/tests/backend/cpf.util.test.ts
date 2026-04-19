import { describe, expect, it } from "vitest";
import { limparCPF } from "../../src/utils/cpf.js";

describe("limparCPF", () => {
  it("remove não dígitos", () => {
    expect(limparCPF("123.456.789-01")).toBe("12345678901");
    expect(limparCPF("")).toBe("");
  });
});
