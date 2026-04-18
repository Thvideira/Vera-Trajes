import type { Request, Response } from "express";
import { processScheduledNotifications } from "../services/notificacao.service.js";

/** Útil para testar o processamento sem esperar o horário do cron */
export async function postRunNow(_req: Request, res: Response): Promise<void> {
  await processScheduledNotifications(new Date());
  res.json({ ok: true });
}
