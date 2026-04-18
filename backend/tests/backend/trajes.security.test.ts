import { beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../src/config/env.js";
import { agent } from "./helpers/appRequest.js";

let app: Express;

beforeAll(async () => {
  const mod = await import("../../src/app.js");
  app = mod.createApp();
});

describe("DELETE /api/trajes/:id — autenticação", () => {
  it("retorna 401 sem Authorization quando AUTH_DISABLED é false", async () => {
    if (env.AUTH_DISABLED) {
      // Com AUTH_DISABLED, a API aceita requisições sem JWT; este caso não se aplica.
      return;
    }
    const res = await agent(app).delete(
      "/api/trajes/000000000000000000000000"
    );
    expect(res.status).toBe(401);
  });

  it("retorna 401 com token JWT inválido", async () => {
    if (env.AUTH_DISABLED) return;
    const res = await agent(app)
      .delete("/api/trajes/000000000000000000000000")
      .set("Authorization", "Bearer token-invalido");
    expect(res.status).toBe(401);
  });
});

describe.skipIf(env.AUTH_DISABLED)("Permissões MOBILE vs ADMIN", () => {
  let mobileToken: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.trim()) return;
    const login = await agent(app).post("/api/auth/login").send({
      email: "mobile@loja.vera",
      password: "mobile123",
    });
    if (login.status !== 200) return;
    mobileToken = login.body.token as string;
  });

  it("MOBILE recebe 403 ao acessar rota só de admin (clientes)", async () => {
    if (!process.env.DATABASE_URL?.trim()) return;
    if (!mobileToken) return;
    const res = await agent(app)
      .get("/api/clientes")
      .set("Authorization", `Bearer ${mobileToken}`);
    expect(res.status).toBe(403);
  });
});

describe("JWT utilitário", () => {
  it("payload MOBILE é reconhecido", () => {
    const token = jwt.sign(
      { sub: "x", email: "m@test.com", role: "MOBILE" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    const decoded = jwt.verify(token, env.JWT_SECRET) as { role: string };
    expect(decoded.role).toBe("MOBILE");
  });
});
