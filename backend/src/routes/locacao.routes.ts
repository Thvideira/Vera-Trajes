import { Router } from "express";
import * as ctrl from "../controllers/locacao.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const locacaoRouter = Router();
locacaoRouter.get("/pagamentos-pendentes", asyncHandler(ctrl.getPagamentosPendentes));
locacaoRouter.get("/relatorio", asyncHandler(ctrl.getRelatorio));
locacaoRouter.post(
  "/validar-intervalo-trajes",
  asyncHandler(ctrl.postValidarIntervaloTrajes)
);
locacaoRouter.post("/", asyncHandler(ctrl.postCreate));
locacaoRouter.get("/", asyncHandler(ctrl.getList));
locacaoRouter.patch(
  "/:id/itens-descritivos/:itemId",
  asyncHandler(ctrl.patchLocacaoItemDescritivoSeparado)
);
locacaoRouter.patch("/:id", asyncHandler(ctrl.patchLocacao));
locacaoRouter.get("/:id/historico", asyncHandler(ctrl.getHistorico));
locacaoRouter.post("/:id/retiradas", asyncHandler(ctrl.postRetirada));
locacaoRouter.post("/:id/pagamentos", asyncHandler(ctrl.postPagamento));
locacaoRouter.post("/:id/cancelar", asyncHandler(ctrl.postCancelarLocacao));
locacaoRouter.get("/:id", asyncHandler(ctrl.getOne));
