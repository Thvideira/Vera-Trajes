import { describe, expect, it } from "vitest";
import {
  clienteCorrespondeBusca,
  normalizarTermoBuscaClientes,
} from "../../src/utils/clienteBusca.js";

describe("normalizarTermoBuscaClientes", () => {
  it("trim e lowercase", () => {
    expect(normalizarTermoBuscaClientes("  João  ")).toBe("joão");
  });

  it("undefined e vazio", () => {
    expect(normalizarTermoBuscaClientes(undefined)).toBe("");
    expect(normalizarTermoBuscaClientes("")).toBe("");
  });
});

describe("clienteCorrespondeBusca", () => {
  const cliente = {
    nome: "João da Silva",
    cpf: "12345678901",
  };

  it("sem termo: todos passam", () => {
    expect(clienteCorrespondeBusca(undefined, cliente.nome, cliente.cpf)).toBe(
      true
    );
    expect(clienteCorrespondeBusca("   ", cliente.nome, cliente.cpf)).toBe(true);
  });

  it("busca por nome", () => {
    expect(clienteCorrespondeBusca("joão", cliente.nome, cliente.cpf)).toBe(
      true
    );
    expect(clienteCorrespondeBusca("maria", cliente.nome, cliente.cpf)).toBe(
      false
    );
  });

  it("com dígitos: só CPF", () => {
    expect(clienteCorrespondeBusca("12345678901", cliente.nome, cliente.cpf)).toBe(
      true
    );
    expect(clienteCorrespondeBusca("123.456.789-01", cliente.nome, cliente.cpf)).toBe(
      true
    );
    expect(clienteCorrespondeBusca("999", cliente.nome, cliente.cpf)).toBe(false);
  });

  it("com dígitos não mistura nome: joão123 prioriza CPF", () => {
    expect(clienteCorrespondeBusca("joão123", "João Silva", "11111111111")).toBe(
      false
    );
  });
});
