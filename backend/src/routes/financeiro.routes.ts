import { Router } from "express";
import * as ctrl from "../controllers/financeiro.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const financeiroRouter = Router();
financeiroRouter.get("/:locacaoId", asyncHandler(ctrl.getLocacaoDetalhe));
