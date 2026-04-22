import { describe, expect, it } from "vitest";
import {
  coalesceItensDescritivosFromLocacao,
  isAcessorioIdPersistidoNoServidor,
} from "./acessoriosLocacao";

describe("coalesceItensDescritivosFromLocacao", () => {
  it("usa acessorios quando itensDescritivos vem vazio", () => {
    const row = {
      itensDescritivos: [],
      acessorios: [
        { id: "a1", nome: "Gravata", quantidade: 2, variacao: null, observacao: null, separado: false },
      ],
    };
    expect(coalesceItensDescritivosFromLocacao(row)).toEqual([
      expect.objectContaining({
        id: "a1",
        descricao: "Gravata",
        quantidade: 2,
        variacao: null,
        observacao: null,
        separado: false,
      }),
    ]);
  });

  it("mantém itensDescritivos quando tem conteúdo (ignora acessorios vazio)", () => {
    const row = {
      itensDescritivos: [
        { id: "x1", descricao: "Cinto", quantidade: 1, variacao: null, observacao: null, separado: true },
      ],
      acessorios: [],
    };
    expect(coalesceItensDescritivosFromLocacao(row)).toEqual([
      expect.objectContaining({ id: "x1", descricao: "Cinto", separado: true }),
    ]);
  });

  it("aceita linha só com nome (sem id) e gera id local", () => {
    const row = {
      acessorios: [{ nome: " Suspensório ", quantidade: 3 }],
    };
    const out = coalesceItensDescritivosFromLocacao(row);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "__local-0",
      descricao: "Suspensório",
      quantidade: 3,
    });
  });

  it("aceita itens_descritivos em snake_case", () => {
    const row = {
      itens_descritivos: [{ id: "s1", descricao: "Meia", quantidade: 1 }],
    };
    expect(coalesceItensDescritivosFromLocacao(row)[0]?.descricao).toBe("Meia");
  });
});

describe("isAcessorioIdPersistidoNoServidor", () => {
  it("rejeita prefixo __local-", () => {
    expect(isAcessorioIdPersistidoNoServidor("__local-0")).toBe(false);
    expect(isAcessorioIdPersistidoNoServidor("clxyz1234567890123456789")).toBe(true);
  });
});
