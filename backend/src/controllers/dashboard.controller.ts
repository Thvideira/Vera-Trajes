import type { Request, Response } from "express";
import * as service from "../services/dashboard.service.js";

export async function getDashboard(_req: Request, res: Response) {
  const data = await service.getDashboard();
  res.json(data);
}
