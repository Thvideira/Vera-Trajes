import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",
    specPattern: "tests/e2e/**/*.cy.ts",
    supportFile: "tests/e2e/support/e2e.ts",
    video: false,
    defaultCommandTimeout: 12_000,
  },
});
