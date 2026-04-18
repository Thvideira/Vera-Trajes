import { Router } from "express";
import * as ctrl from "../controllers/dashboard.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const dashboardRouter = Router();
dashboardRouter.get("/", asyncHandler(ctrl.getDashboard));
