import { beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import { agent } from "./helpers/appRequest.js";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());

let app: Express;

beforeAll(async () => {
  const mod = await import("../../src/app.js");
  app = mod.createApp();
});

describe.skipIf(!hasDb)("POST /api/auth/login — integração (requer DATABASE_URL)", () => {
  it("retorna 401 com senha incorreta", async () => {
    const res = await agent(app).post("/api/auth/login").send({
      email: "admin@loja.vera",
      password: "senha-errada-12345",
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/credenciais/i);
  });

  it("retorna 200 e token com credenciais válidas (admin seed)", async () => {
    const res = await agent(app).post("/api/auth/login").send({
      email: "admin@loja.vera",
      password: "admin123",
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user?.role).toBe("ADMIN");
  });

  it("retorna 200 para usuário mobile seed com role MOBILE", async () => {
    const res = await agent(app).post("/api/auth/login").send({
      email: "mobile@loja.vera",
      password: "mobile123",
    });
    expect(res.status).toBe(200);
    expect(res.body.user?.role).toBe("MOBILE");
  });
});
