import type { Request, Response } from "express";
import { loginSchema } from "../validation/schemas.js";
import * as authService from "../services/auth.service.js";

export async function postLogin(req: Request, res: Response): Promise<void> {
  const body = loginSchema.parse(req.body);
  const result = await authService.login(body.email, body.password);
  res.json(result);
}
