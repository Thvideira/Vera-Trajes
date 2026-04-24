import cors from "cors";
import express from "express";
import path from "path";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authMiddleware } from "./middleware/auth.js";
import { requireAdmin } from "./middleware/requireAdmin.js";
import { ajusteRouter } from "./routes/ajuste.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { cepRouter } from "./routes/cep.routes.js";
import { clienteRouter } from "./routes/cliente.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { financeiroRouter } from "./routes/financeiro.routes.js";
import { locacaoRouter } from "./routes/locacao.routes.js";
import { movimentacaoRouter } from "./routes/movimentacao.routes.js";
import { pagamentoRouter } from "./routes/pagamento.routes.js";
import { notificacaoRouter } from "./routes/notificacao.routes.js";
import { retiradaRouter } from "./routes/retirada.routes.js";
import { trajeLocadoRouter } from "./routes/trajeLocado.routes.js";
import { trajeRouter } from "./routes/traje.routes.js";

export function createApp() {
  const app = express();

  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()),
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  const uploadsTrajes = path.resolve(env.UPLOAD_LOCAL_DIR, "trajes");
  app.use(
    "/files/trajes",
    express.static(uploadsTrajes, { fallthrough: true })
  );

  app.use("/api/auth", authRouter);
  app.use("/api/cep", cepRouter);

  app.use(authMiddleware);
  app.use("/api/clientes", requireAdmin, clienteRouter);
  app.use("/api/trajes", trajeRouter);
  app.use("/api/locacoes", requireAdmin, locacaoRouter);
  app.use("/api/retiradas", requireAdmin, retiradaRouter);
  app.use("/api/trajes-locados", requireAdmin, trajeLocadoRouter);
  app.use("/api/movimentacoes", requireAdmin, movimentacaoRouter);
  app.use("/api/ajustes", requireAdmin, ajusteRouter);
  app.use("/api/dashboard", requireAdmin, dashboardRouter);
  app.use("/api/financeiro", requireAdmin, financeiroRouter);
  app.use("/api/pagamentos", requireAdmin, pagamentoRouter);
  app.use("/api/notificacoes", requireAdmin, notificacaoRouter);

  app.use(errorHandler);
  return app;
}
