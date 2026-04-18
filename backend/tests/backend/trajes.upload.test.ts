import { beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import { agent } from "./helpers/appRequest.js";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());

let app: Express;
let adminToken: string;
let trajeId: string;

describe.skipIf(!hasDb)("POST /api/trajes/:id/foto — upload", () => {
  beforeAll(async () => {
    const mod = await import("../../src/app.js");
    app = mod.createApp();
    const login = await agent(app).post("/api/auth/login").send({
      email: "admin@loja.vera",
      password: "admin123",
    });
    if (login.status !== 200) return;
    adminToken = login.body.token as string;
    const codigo = `up-${Date.now()}`;
    const create = await agent(app)
      .post("/api/trajes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        nome: "Upload test",
        tipo: "VESTIDO",
        codigo,
        tamanho: "P",
      });
    if (create.status === 201) trajeId = create.body.id as string;
  });

  it("retorna 400 quando nenhum arquivo é enviado", async () => {
    if (!trajeId) return;
    const res = await agent(app)
      .post(`/api/trajes/${trajeId}/foto`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/arquivo|obrigatório/i);
  });
});
