import { useEffect, useState } from "react";
import { apiConfig } from "../config/api";
import { ApiError, getJson } from "../services/apiClient";
import type { HealthResponse } from "../types/api";

type ConnectionState =
  | { status: "checking" }
  | { status: "connected"; uptimeSeconds: number }
  | { status: "disconnected"; message: string };

export function ApiStatus() {
  const [connection, setConnection] = useState<ConnectionState>({
    status: "checking",
  });

  useEffect(() => {
    const controller = new AbortController();

    getJson<HealthResponse>(apiConfig.healthPath, controller.signal)
      .then(({ status, uptimeSeconds }) => {
        if (status !== "ok") {
          throw new Error("The API returned an unexpected health status.");
        }
        setConnection({ status: "connected", uptimeSeconds });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        const message =
          error instanceof ApiError || error instanceof Error
            ? error.message
            : "An unexpected error occurred while contacting the API.";
        setConnection({ status: "disconnected", message });
      });

    return () => controller.abort();
  }, []);

  if (connection.status === "checking") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-600">Checking the API connection…</p>
      </div>
    );
  }

  if (connection.status === "disconnected") {
    return (
      <div
        aria-live="polite"
        className="rounded-xl border border-amber-300 bg-amber-50 p-5"
        role="status"
      >
        <p className="font-semibold text-amber-950">API is not reachable</p>
        <p className="mt-1 text-sm text-amber-900">{connection.message}</p>
      </div>
    );
  }

  return (
    <div
      aria-live="polite"
      className="flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5"
      role="status"
    >
      <div>
        <p className="font-semibold text-emerald-950">API connected</p>
        <p className="mt-1 text-sm text-emerald-800">
          Express is responding to health checks.
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-medium text-emerald-800">
        {Math.floor(connection.uptimeSeconds)}s uptime
      </span>
    </div>
  );
}
