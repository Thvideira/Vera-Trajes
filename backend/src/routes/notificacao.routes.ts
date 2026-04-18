import { Router } from "express";
import * as ctrl from "../controllers/notificacao.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const notificacaoRouter = Router();
notificacaoRouter.post("/executar", asyncHandler(ctrl.postRunNow));
