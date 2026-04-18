import { beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import { agent } from "./helpers/appRequest.js";

let app: Express;

beforeAll(async () => {
  const mod = await import("../../src/app.js");
  app = mod.createApp();
});

describe("POST /api/auth/login — validação", () => {
  it("retorna 400 para e-mail inválido", async () => {
    const res = await agent(app).post("/api/auth/login").send({
      email: "nao-e-email",
      password: "123456",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("retorna 400 para senha curta", async () => {
    const res = await agent(app).post("/api/auth/login").send({
      email: "admin@loja.vera",
      password: "123",
    });
    expect(res.status).toBe(400);
  });
});
