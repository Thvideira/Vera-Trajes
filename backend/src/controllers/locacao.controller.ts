import type { Request, Response } from "express";
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

export async function getList(req: Request, res: Response) {
  const q = listLocacaoQuerySchema.parse(req.query);
  const rows = await service.listLocacoes({
    encerrada: q.encerrada,
    dataInicio: q.dataInicio,
    dataFim: q.dataFim,
    dataEvento: q.dataEvento,
  });
  res.json(rows);
}

export async function getOne(req: Request, res: Response) {
  const row = await service.getLocacao(requireParam(req.params.id));
  res.json(row);
}

export async function getHistorico(req: Request, res: Response) {
  const rows = await service.listHistorico(requireParam(req.params.id));
  res.json(rows);
}

export async function patchLocacao(req: Request, res: Response) {
  const data = locacaoPatchSchema.parse(req.body);
  const row = await service.patchLocacao(requireParam(req.params.id), data);
  res.json(row);
}

export async function patchLocacaoItemDescritivoSeparado(req: Request, res: Response) {
  const body = locacaoItemDescritivoSeparadoSchema.parse(req.body);
  const row = await service.patchLocacaoItemDescritivoSeparado(
    requireParam(req.params.id),
    requireParam(req.params.itemId),
    body.separado
  );
  res.json(row);
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
  res.status(201).json(row);
}

export async function postRetirada(req: Request, res: Response) {
  const body = retiradaAddSchema.parse(req.body);
  const row = await service.addRetirada(requireParam(req.params.id), {
    dataRetirada: body.dataRetirada,
    trajes: body.trajes,
  });
  res.status(201).json(row);
}

export async function postPagamento(req: Request, res: Response) {
  const body = pagamentoSchema.parse(req.body);
  const row = await service.registrarPagamento(
    requireParam(req.params.id),
    body.valor,
    body.tipo
  );
  res.json(row);
}

export async function getPagamentosPendentes(_req: Request, res: Response) {
  const rows = await service.listarPagamentosPendentes();
  res.json(
    rows.map((r) => ({
      ...r,
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
