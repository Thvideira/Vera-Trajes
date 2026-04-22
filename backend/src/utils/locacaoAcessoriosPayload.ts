import type { z } from "zod";
import { locacaoAcessorioLinhaPayload } from "../validation/schemas.js";

type AcessorioLinha = z.infer<typeof locacaoAcessorioLinhaPayload>;

/** Converte payload `acessorios[].nome` para o formato interno `itensDescritivos[].descricao`. */
export function acessoriosPayloadParaItensDescritivos(
  linhas: AcessorioLinha[]
): {
  descricao: string;
  quantidade: number;
  variacao: string | null;
  observacao: string | null;
  separado: boolean;
}[] {
  return linhas.map((a) => ({
    descricao: a.nome.trim(),
    quantidade: a.quantidade ?? 1,
    variacao: a.variacao?.trim() ? a.variacao.trim() : null,
    observacao: a.observacao?.trim() ? a.observacao.trim() : null,
    separado: a.separado ?? false,
  }));
}
