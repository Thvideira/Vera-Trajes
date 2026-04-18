import { Router } from "express";
import * as ctrl from "../controllers/trajeLocado.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const trajeLocadoRouter = Router();
trajeLocadoRouter.patch("/:id", asyncHandler(ctrl.patchTrajeLocado));
trajeLocadoRouter.delete("/:id", asyncHandler(ctrl.deleteTrajeLocado));
trajeLocadoRouter.post(
  "/:id/costureira/encaminhar",
  asyncHandler(ctrl.postEncaminharCostureira)
);
trajeLocadoRouter.post("/:id/encaminhar-lavagem", asyncHandler(ctrl.postEncaminharLavagem));
trajeLocadoRouter.post("/:id/marcar-pronto", asyncHandler(ctrl.postMarcarPronto));
trajeLocadoRouter.post("/:id/lavagem/iniciar", asyncHandler(ctrl.postIniciarLavagem));
trajeLocadoRouter.post("/:id/lavagem/concluir", asyncHandler(ctrl.postConcluirLavagem));
trajeLocadoRouter.post("/:id/retirado", asyncHandler(ctrl.postRetirado));
trajeLocadoRouter.post("/:id/finalizado", asyncHandler(ctrl.postFinalizado));
