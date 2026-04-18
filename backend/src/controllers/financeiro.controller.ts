import type { Request, Response } from "express";
import { requireParam } from "../utils/param.js";
import * as service from "../services/financeiro.service.js";

export async function getLocacaoDetalhe(req: Request, res: Response) {
  const row = await service.getFinanceiroLocacaoDetalhe(
    requireParam(req.params.locacaoId)
  );
  res.json(row);
}
