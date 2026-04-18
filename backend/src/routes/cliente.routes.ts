import { Router } from "express";
import * as ctrl from "../controllers/cliente.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const clienteRouter = Router();
clienteRouter.get("/", asyncHandler(ctrl.getList));
clienteRouter.get("/:id", asyncHandler(ctrl.getOne));
clienteRouter.post("/", asyncHandler(ctrl.postCreate));
clienteRouter.put("/:id", asyncHandler(ctrl.putUpdate));
clienteRouter.delete("/:id", asyncHandler(ctrl.deleteOne));
