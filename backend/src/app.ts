import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { apiRoutes } from "./routes/apiRoutes.js";
import { demoRoutes } from "./routes/demoRoutes.js";

export const app = express();

app.use(
  cors({
    origin: env.frontendOrigins,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use("/api", env.demoMode ? demoRoutes : apiRoutes);
app.use(notFound);
app.use(errorHandler);
