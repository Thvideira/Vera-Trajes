import type { Request, Response } from "express";
import { requireParam } from "../utils/param.js";

export async function getCep(req: Request, res: Response) {
  const raw = requireParam(req.params.cep, "cep").replace(/\D/g, "");
  if (raw.length !== 8) {
    res.status(400).json({ error: "CEP inválido" });
    return;
  }
  const r = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
  const data = (await r.json()) as { erro?: boolean };
  if (!r.ok || data.erro) {
    res.status(404).json({ error: "CEP não encontrado" });
    return;
  }
  res.json(data);
}
