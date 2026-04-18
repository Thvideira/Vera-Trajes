import type { Request, Response } from "express";
import { requireParam } from "../utils/param.js";
import { retiradaPatchSchema } from "../validation/schemas.js";
import * as service from "../services/locacao.service.js";
import { addTrajeLocadoBodySchema } from "../validation/schemas.js";

export async function patchRetirada(req: Request, res: Response) {
  const data = retiradaPatchSchema.parse(req.body);
  const row = await service.patchRetirada(requireParam(req.params.id), data);
  res.json(row);
}

export async function deleteRetirada(req: Request, res: Response) {
  await service.deleteRetirada(requireParam(req.params.id));
  res.status(204).send();
}

export async function postTraje(req: Request, res: Response) {
  const body = addTrajeLocadoBodySchema.parse(req.body);
  const row = await service.addTrajeLocado(requireParam(req.params.id), body);
  res.status(201).json(row);
}
