import { Router } from "express";
import * as ctrl from "../controllers/pagamento.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const pagamentoRouter = Router();
pagamentoRouter.get("/historico", asyncHandler(ctrl.getHistorico));
pagamentoRouter.post("/:id/registrar", asyncHandler(ctrl.postRegistrar));
