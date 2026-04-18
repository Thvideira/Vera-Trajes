import { Router } from "express";
import * as ctrl from "../controllers/ajuste.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const ajusteRouter = Router();
ajusteRouter.get("/pendentes", asyncHandler(ctrl.getPendentes));
ajusteRouter.post(
  "/trajes-locados/:trajeLocadoId",
  asyncHandler(ctrl.postAjuste)
);
ajusteRouter.patch("/:id", asyncHandler(ctrl.patchAjuste));
