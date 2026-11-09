import { Router } from "express";
import { healthController } from "../controllers/healthController.js";

export const demoRoutes = Router();

demoRoutes.get("/health", healthController);
demoRoutes.get("/demo", (_request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.json({
    mode: "read-only",
    roles: ["donor", "ngo", "delivery_partner", "admin"],
    message: "Sample data only. This endpoint does not read or write user data.",
  });
});
