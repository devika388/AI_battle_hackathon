const configuredApiBase = import.meta.env.VITE_API_BASE_URL || "/api";

export const apiConfig = {
  baseUrl: configuredApiBase.replace(/\/+$/, ""),
  healthPath: "/health",
};
