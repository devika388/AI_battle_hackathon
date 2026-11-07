import type { HealthResponse } from "../types/api.js";

export function getHealth(): HealthResponse {
  return {
    status: "ok",
    uptimeSeconds: process.uptime(),
  };
}
