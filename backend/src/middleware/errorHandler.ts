import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { env } from "../config/env.js";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
    });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validação falhou",
      details: err.flatten(),
    });
    return;
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error(err);
    res.status(503).json({
      error:
        "Não foi possível conectar ao banco de dados. Verifique se o PostgreSQL está rodando e se DATABASE_URL no backend/.env está correta.",
    });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(err);
    const dev = env.NODE_ENV !== "production";
    let message = "Erro ao acessar o banco de dados.";
    if (err.code === "P2022") {
      message =
        "O banco está desatualizado (coluna ou tabela inexistente). No diretório backend, rode: npx prisma db push && npx prisma db seed";
    }
    res.status(500).json({
      error: message,
      ...(dev && { code: err.code, prismaMessage: err.message }),
    });
    return;
  }
  console.error(err);
  const dev = env.NODE_ENV !== "production";
  res.status(500).json({
    error: dev && err instanceof Error ? err.message : "Erro interno do servidor",
  });
}
