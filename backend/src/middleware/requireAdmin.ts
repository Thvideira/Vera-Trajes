import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { AppError } from "./errorHandler.js";

/** Bloqueia usuários MOBILE (apenas ADMIN ou AUTH_DISABLED). */
export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (env.AUTH_DISABLED) {
    next();
    return;
  }
  const role = req.user?.role;
  if (role === "ADMIN") {
    next();
    return;
  }
  next(new AppError(403, "Acesso restrito a administradores"));
}
