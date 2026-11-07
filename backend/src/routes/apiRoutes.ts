import { Router } from "express";
import { healthController } from "../controllers/healthController.js";

export const apiRoutes = Router();

apiRoutes.get("/health", healthController);
