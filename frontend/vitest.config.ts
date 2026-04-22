import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["tests/frontend/setup.ts"],
    include: [
      "tests/frontend/**/*.test.ts",
      "tests/frontend/**/*.test.tsx",
      "src/**/*.test.ts",
    ],
    css: true,
  },
});
