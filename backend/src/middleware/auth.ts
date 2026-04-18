import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./errorHandler.js";

export type UserRoleJwt = "ADMIN" | "MOBILE";

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRoleJwt;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/** Authorization Bearer ou `?token=` (útil para EventSource/SSE, que não envia header). */
export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const q = req.query.token;
  if (typeof q === "string" && q.length > 0) return q;
  return null;
}

export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (env.AUTH_DISABLED) {
    next();
    return;
  }
  const token = extractBearerToken(req);
  if (!token) {
    next(new AppError(401, "Não autorizado"));
    return;
  }
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = {
      ...decoded,
      role: decoded.role ?? "ADMIN",
    };
    next();
  } catch {
    next(new AppError(401, "Token inválido"));
  }
}
