import type { NextFunction, Request, Response } from "express";
import { requireParam } from "../utils/param.js";
import { listTrajeQuerySchema, trajeCreateSchema, trajeUpdateSchema } from "../validation/schemas.js";
import * as service from "../services/traje.service.js";
import {
  addTrajeCatalogSseClient,
  broadcastTrajeCatalogChanged,
  removeTrajeCatalogSseClient,
} from "../services/trajeCatalogBroadcast.service.js";
import { assertImageMime, assertSize, saveTrajeImage } from "../services/upload.service.js";

export function getCatalogStream(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("\n");
  addTrajeCatalogSseClient(res);

  const ping = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      clearInterval(ping);
      removeTrajeCatalogSseClient(res);
    }
  }, 25000);

  const close = (): void => {
    clearInterval(ping);
    removeTrajeCatalogSseClient(res);
  };
  req.on("close", close);
  res.on("close", close);
}

export async function getList(req: Request, res: Response) {
  const q = listTrajeQuerySchema.parse(req.query);
  const rows = await service.listTrajes(q);
  res.json(rows);
}

export async function getOne(req: Request, res: Response) {
  const row = await service.getTraje(requireParam(req.params.id));
  res.json(row);
}

export async function postCreate(req: Request, res: Response) {
  const data = trajeCreateSchema.parse(req.body);
  const row = await service.createTraje(data);
  broadcastTrajeCatalogChanged();
  res.status(201).json(row);
}

export async function putUpdate(req: Request, res: Response) {
  const data = trajeUpdateSchema.parse(req.body);
  const row = await service.updateTraje(requireParam(req.params.id), data);
  broadcastTrajeCatalogChanged();
  res.json(row);
}

export async function deleteOne(req: Request, res: Response) {
  await service.deleteTraje(requireParam(req.params.id));
  broadcastTrajeCatalogChanged();
  res.status(204).send();
}

export async function postFoto(req: Request, res: Response) {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "Arquivo obrigatório" });
    return;
  }
  assertImageMime(file.mimetype);
  assertSize(file.size);
  const traje = await service.getTraje(requireParam(req.params.id));
  const url = await saveTrajeImage(traje.codigo, file.buffer, file.mimetype);
  const row = await service.setTrajeFotoUrl(traje.id, url);
  broadcastTrajeCatalogChanged();
  res.json(row);
}

export async function deleteFoto(req: Request, res: Response) {
  const row = await service.setTrajeFotoUrl(requireParam(req.params.id), null);
  broadcastTrajeCatalogChanged();
  res.json(row);
}
