/**
 * Carrega variáveis antes de qualquer import do app.
 * Opcional: `backend/.env.test` (não versionado) sobrescreve `.env`.
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
/** Pasta `backend/` (este arquivo está em `backend/tests/backend/`) */
const backendRoot = path.resolve(dir, "..", "..");

config({ path: path.join(backendRoot, ".env") });
config({ path: path.join(backendRoot, ".env.test"), override: true });
