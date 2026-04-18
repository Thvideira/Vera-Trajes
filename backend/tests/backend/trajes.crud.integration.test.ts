import { beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import { agent } from "./helpers/appRequest.js";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());

let app: Express;
let adminToken: string;

beforeAll(async () => {
  const mod = await import("../../src/app.js");
  app = mod.createApp();
});

describe.skipIf(!hasDb)("Trajes — CRUD (integração)", () => {
  beforeAll(async () => {
    const login = await agent(app).post("/api/auth/login").send({
      email: "admin@loja.vera",
      password: "admin123",
    });
    if (login.status !== 200) {
      throw new Error("Seed admin ausente: rode npm run db:seed no backend");
    }
    adminToken = login.body.token as string;
  });

  it("GET /api/trajes com token retorna lista", async () => {
    const res = await agent(app)
      .get("/api/trajes")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("cria traje, exclui e some da listagem", async () => {
    const codigo = `e2e-${Date.now()}`;
    const create = await agent(app)
      .post("/api/trajes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        nome: "Traje teste e2e",
        tipo: "VESTIDO",
        codigo,
        tamanho: "M",
      });
    expect(create.status).toBe(201);
    const id = create.body.id as string;

    const listBefore = await agent(app)
      .get("/api/trajes")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(listBefore.body.some((t: { id: string }) => t.id === id)).toBe(
      true
    );

    const del = await agent(app)
      .delete(`/api/trajes/${id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(del.status).toBe(204);

    const listAfter = await agent(app)
      .get("/api/trajes")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(listAfter.body.some((t: { id: string }) => t.id === id)).toBe(
      false
    );
  });
});
