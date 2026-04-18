import type { Express } from "express";
import request from "supertest";

export function agent(app: Express) {
  return request(app);
}
