export interface HealthResponse {
  status: "ok";
  uptimeSeconds: number;
}

export interface ApiErrorResponse {
  error: string;
}
