import { Router } from "express";
import * as ctrl from "../controllers/retirada.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const retiradaRouter = Router();
retiradaRouter.patch("/:id", asyncHandler(ctrl.patchRetirada));
retiradaRouter.delete("/:id", asyncHandler(ctrl.deleteRetirada));
retiradaRouter.post("/:id/trajes", asyncHandler(ctrl.postTraje));
