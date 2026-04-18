import type { Request, Response } from "express";
import { requireParam } from "../utils/param.js";
import {
  clienteCreateSchema,
  clienteUpdateSchema,
} from "../validation/schemas.js";
import * as service from "../services/cliente.service.js";

export async function getList(req: Request, res: Response) {
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  const rows = await service.listClientes({ q });
  res.json(rows);
}

export async function getOne(req: Request, res: Response) {
  const row = await service.getCliente(requireParam(req.params.id));
  res.json(row);
}

export async function postCreate(req: Request, res: Response) {
  const data = clienteCreateSchema.parse(req.body);
  const row = await service.createCliente(data);
  res.status(201).json(row);
}

export async function putUpdate(req: Request, res: Response) {
  const data = clienteUpdateSchema.parse(req.body);
  const row = await service.updateCliente(requireParam(req.params.id), data);
  res.json(row);
}

export async function deleteOne(req: Request, res: Response) {
  await service.deleteCliente(requireParam(req.params.id));
  res.status(204).send();
}
