/**
 * Alinha o PostgreSQL com o schema antes dos testes (evita P2022, ex.: coluna
 * `precisa_ajuste` ausente após atualizar o Prisma sem migrar o banco).
 *
 * - `migrate deploy` quando o histórico `_prisma_migrations` já existe.
 * - Se o deploy falhar com P3005 (banco criado antes com `db push` apenas),
 *   aplica o SQL da migration v2 com `db execute`, marca como aplicada com
 *   `migrate resolve`, e tenta `migrate deploy` de novo.
 *
 * Desative com `SKIP_PRISMA_TEST_SYNC=1`.
 */
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(dir, "..", "..");

const V2_MIGRATION = "20260417140000_traje_locado_status_v2";

async function columnPrecisaAjusteExists(): Promise<boolean> {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRaw<{ ok: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'trajes_locados'
          AND column_name = 'precisa_ajuste'
      ) AS ok
    `;
    return Boolean(rows[0]?.ok);
  } catch {
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

function runMigrateDeploy(): "ok" | "p3005" | "other" {
  try {
    execSync("npx prisma migrate deploy", {
      cwd: backendRoot,
      stdio: "pipe",
      encoding: "utf-8",
      env: process.env,
    });
    return "ok";
  } catch (e: unknown) {
    const err = e as { stderr?: string; stdout?: string; message?: string };
    const msg = `${err.stderr ?? ""}${err.stdout ?? ""}${err.message ?? ""}`;
    if (msg.includes("P3005")) return "p3005";
    console.error(msg);
    return "other";
  }
}

function tryResolveApplied(): void {
  try {
    execSync(
      `npx prisma migrate resolve --applied ${V2_MIGRATION} --schema prisma/schema.prisma`,
      { cwd: backendRoot, stdio: "pipe", encoding: "utf-8", env: process.env }
    );
  } catch {
    // já marcada ou tabela de migrations inexistente até o segundo deploy
  }
}

export default async function prismaTestDbSync(): Promise<void> {
  config({ path: path.join(backendRoot, ".env") });
  config({ path: path.join(backendRoot, ".env.test"), override: true });

  if (!process.env.DATABASE_URL?.trim()) return;
  if (process.env.SKIP_PRISMA_TEST_SYNC === "1") return;

  const first = runMigrateDeploy();
  if (first === "ok") return;
  if (first === "other") {
    throw new Error("prisma migrate deploy falhou (veja stderr acima).");
  }

  const hasCol = await columnPrecisaAjusteExists();
  if (!hasCol) {
    execSync(
      `npx prisma db execute --file prisma/migrations/${V2_MIGRATION}/migration.sql --schema prisma/schema.prisma`,
      { cwd: backendRoot, stdio: "inherit", env: process.env }
    );
  }

  tryResolveApplied();

  const second = runMigrateDeploy();
  if (second !== "ok") {
    throw new Error(
      "Não foi possível alinhar o banco após baseline (migrate deploy / db execute). " +
        "Rode manualmente: npx prisma migrate deploy ou aplique o SQL em prisma/migrations/…/migration.sql"
    );
  }
}
