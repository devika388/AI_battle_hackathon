import { resolve } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), "../.env") });

function readPort(value: string | undefined): number {
  const port = Number(value ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("API_PORT must be an integer between 1 and 65535.");
  }
  return port;
}

function readDemoMode(value: string | undefined): boolean {
  const mode = value?.trim().toLowerCase();
  if (mode === undefined || mode === "") return false;
  if (mode === "true") return true;
  if (mode === "false") return false;
  throw new Error("DEMO_MODE must be true or false.");
}

const frontendOrigin = (process.env.FRONTEND_ORIGIN ?? "http://localhost:5173")
  .trim()
  .replace(/\/+$/, "");

export const env = {
  port: readPort(process.env.PORT ?? process.env.API_PORT),
  frontendOrigin,
  frontendOrigins: [
    ...new Set([frontendOrigin, "http://localhost:5173"]),
  ].filter(Boolean),
  demoMode: readDemoMode(process.env.DEMO_MODE),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};
