import type { Response } from "express";

const clients = new Set<Response>();

export function addTrajeCatalogSseClient(res: Response): void {
  clients.add(res);
}

export function removeTrajeCatalogSseClient(res: Response): void {
  clients.delete(res);
}

/** Notifica todos os clientes conectados ao stream SSE (novo traje, edição, etc.). */
export function broadcastTrajeCatalogChanged(): void {
  const payload = `event: trajes\ndata: {"v":1}\n\n`;
  for (const res of [...clients]) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}
