import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";
import type { JwtPayload, UserRoleJwt } from "../middleware/auth.js";

function roleToJwt(role: UserRole): UserRoleJwt {
  return role === "MOBILE" ? "MOBILE" : "ADMIN";
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw new AppError(401, "Credenciais inválidas");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new AppError(401, "Credenciais inválidas");

  const roleJwt = roleToJwt(user.role);
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: roleJwt,
  };
  let token: string;
  try {
    token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions);
  } catch (e) {
    console.error(e);
    throw new AppError(
      500,
      "Falha ao criar sessão (JWT). Verifique JWT_SECRET e JWT_EXPIRES_IN no arquivo backend/.env (valores não podem estar vazios)."
    );
  }

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      nome: user.nome,
      role: roleJwt,
    },
  };
}
