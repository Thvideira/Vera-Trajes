import { beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import { agent } from "./helpers/appRequest.js";

let app: Express;

beforeAll(async () => {
  const mod = await import("../../src/app.js");
  app = mod.createApp();
});

describe("GET /health", () => {
  it("retorna 200 e { ok: true }", async () => {
    const res = await agent(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
