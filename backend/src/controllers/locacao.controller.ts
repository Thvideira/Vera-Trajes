import type { Request, Response } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { requireParam } from "../utils/param.js";
import {
  listLocacaoQuerySchema,
  locacaoCreateSchema,
  locacaoItemDescritivoSeparadoSchema,
  locacaoPatchSchema,
  pagamentoSchema,
  relatorioQuerySchema,
  retiradaAddSchema,
  validarIntervaloTrajesSchema,
} from "../validation/schemas.js";
import { computeRemaining } from "../services/finance.service.js";
import { validarIntervaloTrajesLocacao } from "../services/locacaoIntervaloTraje.service.js";
import * as service from "../services/locacao.service.js";
import { acessoriosPayloadParaItensDescritivos } from "../utils/locacaoAcessoriosPayload.js";
import { withAcessoriosPublicos } from "../utils/locacaoResponse.js";

export async function getList(req: Request, res: Response) {
  const q = listLocacaoQuerySchema.parse(req.query);
  const rows = await service.listLocacoes({
    encerrada: q.encerrada,
    dataInicio: q.dataInicio,
    dataFim: q.dataFim,
    dataEvento: q.dataEvento,
  });
  const locacoes = rows.map((r) => withAcessoriosPublicos(r));
  console.log("Locações retornadas:", locacoes);
  res.json(locacoes);
}

export async function getOne(req: Request, res: Response) {
  const row = await service.getLocacao(requireParam(req.params.id));
  res.json(withAcessoriosPublicos(row));
}

export async function getHistorico(req: Request, res: Response) {
  const rows = await service.listHistorico(requireParam(req.params.id));
  res.json(rows);
}

export async function patchLocacao(req: Request, res: Response) {
  console.log("Recebido no backend:", req.body);
  const id = requireParam(req.params.id);
  const data = locacaoPatchSchema.parse(req.body);

  if (data.locacaoId !== undefined && data.locacaoId !== id) {
    throw new AppError(
      400,
      "locacaoId do corpo não confere com a locação da URL — vínculo recusado."
    );
  }

  if (data.acessorios !== undefined && data.locacaoId === undefined) {
    throw new AppError(
      400,
      "Ao enviar acessorios, inclua locacaoId no corpo (o mesmo id da locação na URL)."
    );
  }

  let itensDescritivos = data.itensDescritivos;
  if (data.acessorios !== undefined) {
    itensDescritivos = acessoriosPayloadParaItensDescritivos(data.acessorios);
  }

  const serviceInput = {
    observacoes: data.observacoes,
    dataEvento: data.dataEvento,
    dataDevolucaoPrevista: data.dataDevolucaoPrevista,
    ...(itensDescritivos !== undefined ? { itensDescritivos } : {}),
  };

  const temAlteracaoItens = itensDescritivos !== undefined;
  if (temAlteracaoItens) {
    console.info("[locacao PATCH] salvar acessórios/itens", {
      routeLocacaoId: id,
      bodyLocacaoId: data.locacaoId ?? null,
      fonte: data.acessorios !== undefined ? "acessorios" : "itensDescritivos",
      quantidadeLinhas: itensDescritivos!.length,
    });
  }

  const row = await service.patchLocacao(id, serviceInput);

  if (temAlteracaoItens) {
    console.info("[locacao PATCH] resposta após persistir", {
      locacaoId: row.id,
      itensVinculados: row.itensDescritivos.length,
    });
  }

  res.json(withAcessoriosPublicos(row));
}

export async function patchLocacaoItemDescritivoSeparado(req: Request, res: Response) {
  const body = locacaoItemDescritivoSeparadoSchema.parse(req.body);
  const row = await service.patchLocacaoItemDescritivoSeparado(
    requireParam(req.params.id),
    requireParam(req.params.itemId),
    body.separado
  );
  res.json(withAcessoriosPublicos(row));
}

/** Valida intervalo mínimo entre locações do mesmo traje (feedback antes do POST principal). */
export async function postValidarIntervaloTrajes(req: Request, res: Response) {
  const body = validarIntervaloTrajesSchema.parse(req.body);
  const out = await validarIntervaloTrajesLocacao({
    dataInicio: body.dataInicio,
    trajeIds: body.trajeIds,
    excludeLocacaoId: body.excludeLocacaoId,
  });
  res.json(out);
}

export async function postCreate(req: Request, res: Response) {
  const data = locacaoCreateSchema.parse(req.body);
  const row = await service.createLocacao({
    clienteId: data.clienteId,
    observacoes: data.observacoes,
    dataEvento: data.dataEvento,
    dataDevolucaoPrevista: data.dataDevolucaoPrevista ?? null,
    valorTotal: data.valorTotal,
    valorPagoInicial: data.valorPagoInicial,
    retiradas: data.retiradas,
    itensDescritivos: data.itensDescritivos,
  });
  res.status(201).json(withAcessoriosPublicos(row));
}

export async function postRetirada(req: Request, res: Response) {
  const body = retiradaAddSchema.parse(req.body);
  const row = await service.addRetirada(requireParam(req.params.id), {
    dataRetirada: body.dataRetirada,
    trajes: body.trajes,
  });
  res.status(201).json(withAcessoriosPublicos(row));
}

export async function postPagamento(req: Request, res: Response) {
  const body = pagamentoSchema.parse(req.body);
  const row = await service.registrarPagamento(
    requireParam(req.params.id),
    body.valor,
    body.tipo
  );
  res.json(withAcessoriosPublicos(row));
}

export async function getPagamentosPendentes(_req: Request, res: Response) {
  const rows = await service.listarPagamentosPendentes();
  res.json(
    rows.map((r) => ({
      ...withAcessoriosPublicos(r),
      valorRestante: computeRemaining(r.valorTotal, r.valorPago).toFixed(2),
    }))
  );
}

export async function getRelatorio(req: Request, res: Response) {
  const q = relatorioQuerySchema.parse(req.query);
  const row = await service.relatorioFinanceiro({
    inicio: q.inicio,
    fim: q.fim,
  });
  res.json(row);
}

export async function getMovimentacoes(req: Request, res: Response) {
  const trajeId =
    typeof req.query.trajeId === "string" ? req.query.trajeId : undefined;
  const rows = await service.listMovimentacoes(trajeId);
  res.json(rows);
}
