import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return v;
}

/** `JWT_EXPIRES_IN=` no .env vira string vazia; ?? não corrige — isso quebra jwt.sign. */
function nonEmptyOr(
  value: string | undefined,
  fallback: string
): string {
  const t = value?.trim();
  return t && t.length > 0 ? t : fallback;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT) || 4000,
  /** Host de bind (0.0.0.0 = acessível na LAN para testes no celular) */
  LISTEN_HOST: process.env.LISTEN_HOST,
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  JWT_SECRET: nonEmptyOr(
    process.env.JWT_SECRET,
    "dev-secret-change-in-production"
  ),
  JWT_EXPIRES_IN: nonEmptyOr(process.env.JWT_EXPIRES_IN, "7d"),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  UPLOAD_MODE: (process.env.UPLOAD_MODE as "cloudinary" | "local") ?? "local",
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  CLOUDINARY_FOLDER: process.env.CLOUDINARY_FOLDER ?? "loja-vera",
  UPLOAD_LOCAL_DIR: process.env.UPLOAD_LOCAL_DIR ?? "uploads",
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL ?? "http://localhost:4000",
  WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION ?? "v21.0",
  CRON_ENABLED: process.env.CRON_ENABLED !== "false",
  AUTH_DISABLED: process.env.AUTH_DISABLED === "true",
};

export function assertDatabaseUrl(): void {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL não configurada");
  }
}
