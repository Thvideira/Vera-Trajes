import { Router } from "express";
import * as ctrl from "../controllers/locacao.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const movimentacaoRouter = Router();
movimentacaoRouter.get("/", asyncHandler(ctrl.getMovimentacoes));
