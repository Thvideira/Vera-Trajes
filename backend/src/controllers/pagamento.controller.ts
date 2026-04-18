import type { Request, Response } from "express";
import { requireParam } from "../utils/param.js";
import { registrarPagamentoValorSchema } from "../validation/schemas.js";
import * as locacaoService from "../services/locacao.service.js";
import * as pagamentoService from "../services/pagamento.service.js";

/** POST /api/pagamentos/:id/registrar — id = locação (dívida). */
export async function postRegistrar(req: Request, res: Response) {
  const body = registrarPagamentoValorSchema.parse(req.body);
  const row = await locacaoService.registrarPagamentoPorValorPago(
    requireParam(req.params.id),
    body.valor_pago
  );
  res.json(row);
}

export async function getHistorico(_req: Request, res: Response) {
  const rows = await pagamentoService.listHistoricoPagamentos();
  res.json(rows);
}
