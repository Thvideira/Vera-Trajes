import { Router } from "express";
import multer from "multer";
import * as ctrl from "../controllers/traje.controller.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const trajeRouter = Router();
trajeRouter.get("/catalog-stream", ctrl.getCatalogStream);
trajeRouter.get("/", asyncHandler(ctrl.getList));
trajeRouter.get("/:id", asyncHandler(ctrl.getOne));
trajeRouter.post("/", asyncHandler(ctrl.postCreate));
trajeRouter.put("/:id", requireAdmin, asyncHandler(ctrl.putUpdate));
trajeRouter.delete("/:id", requireAdmin, asyncHandler(ctrl.deleteOne));
trajeRouter.post(
  "/:id/foto",
  upload.single("foto"),
  asyncHandler(ctrl.postFoto)
);
trajeRouter.delete("/:id/foto", requireAdmin, asyncHandler(ctrl.deleteFoto));
