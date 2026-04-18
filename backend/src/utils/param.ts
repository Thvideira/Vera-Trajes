import { AppError } from "../middleware/errorHandler.js";

export function requireParam(
  value: string | string[] | undefined,
  name = "id"
): string {
  if (typeof value === "string" && value.length) return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  throw new AppError(400, `Parâmetro inválido: ${name}`);
}
