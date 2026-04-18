import type { Request, Response } from "express";
import { requireParam } from "../utils/param.js";
import { trajeLocadoPatchSchema } from "../validation/schemas.js";
import * as service from "../services/locacao.service.js";

export async function patchTrajeLocado(req: Request, res: Response) {
  const data = trajeLocadoPatchSchema.parse(req.body);
  const row = await service.patchTrajeLocado(requireParam(req.params.id), data);
  res.json(row);
}

export async function deleteTrajeLocado(req: Request, res: Response) {
  const row = await service.removeTrajeLocado(requireParam(req.params.id));
  res.json(row);
}

export async function postEncaminharLavagem(req: Request, res: Response) {
  const row = await service.postEnviarParaLavagem(requireParam(req.params.id));
  res.json(row);
}

export async function postMarcarPronto(req: Request, res: Response) {
  const row = await service.postMarcarProntoRetirada(requireParam(req.params.id));
  res.json(row);
}

export async function postIniciarLavagem(req: Request, res: Response) {
  const row = await service.postIniciarLavagem(requireParam(req.params.id));
  res.json(row);
}

export async function postConcluirLavagem(req: Request, res: Response) {
  const row = await service.postConcluirLavagem(requireParam(req.params.id));
  res.json(row);
}

export async function postRetirado(req: Request, res: Response) {
  const row = await service.postTrajeRetirado(requireParam(req.params.id));
  res.json(row);
}

export async function postFinalizado(req: Request, res: Response) {
  const row = await service.postTrajeFinalizado(requireParam(req.params.id));
  res.json(row);
}
