import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dir, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    globalSetup: [path.join(dir, "tests/backend/globalSetup.ts")],
    setupFiles: [path.join(dir, "tests/backend/setup.ts")],
    include: ["tests/backend/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
    deps: { interopDefault: true },
  },
});
