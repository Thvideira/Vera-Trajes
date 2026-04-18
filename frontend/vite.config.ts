import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Permite abrir o app no celular na mesma rede Wi‑Fi (http://IP-DO-MAC:5173)
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        timeout: 0,
        proxyTimeout: 0,
      },
      "/files": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
});
