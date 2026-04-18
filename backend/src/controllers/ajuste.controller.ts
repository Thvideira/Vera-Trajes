import type { Request, Response } from "express";
import { requireParam } from "../utils/param.js";
import { ajusteCreateSchema, ajusteStatusSchema } from "../validation/schemas.js";
import * as service from "../services/ajuste.service.js";

export async function getPendentes(_req: Request, res: Response) {
  const rows = await service.listPendentes();
  res.json(rows);
}

export async function postAjuste(req: Request, res: Response) {
  const data = ajusteCreateSchema.parse(req.body);
  const row = await service.addAjuste(
    requireParam(req.params.trajeLocadoId, "trajeLocadoId"),
    data
  );
  res.status(201).json(row);
}

export async function patchAjuste(req: Request, res: Response) {
  const { status } = ajusteStatusSchema.parse(req.body);
  const row = await service.updateAjusteStatus(requireParam(req.params.id), status);
  res.json(row);
}
