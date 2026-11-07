import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(process.cwd(), ".."), "");
  const apiBase = env.VITE_API_BASE_URL || "/api";
  const proxyPath = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;

  return {
    envDir: resolve(process.cwd(), ".."),
    plugins: [react()],
    server: {
      proxy: {
        [proxyPath]: {
          target: `http://localhost:${env.API_PORT || "3001"}`,
          changeOrigin: true,
        },
      },
    },
  };
});
