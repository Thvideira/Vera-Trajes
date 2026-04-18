import { Router } from "express";
import * as ctrl from "../controllers/cep.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const cepRouter = Router();
cepRouter.get("/:cep", asyncHandler(ctrl.getCep));
