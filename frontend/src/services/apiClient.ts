import { apiConfig } from "../config/api";
import type { ApiErrorResponse } from "../types/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiConfig.baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...Object.fromEntries(new Headers(init.headers).entries()),
    },
  });

  if (!response.ok) {
    let message = `The API request to ${path} failed with status ${response.status}.`;

    try {
      const body = (await response.json()) as ApiErrorResponse;
      if (body.error) {
        message = body.error;
      }
    } catch {
      // Keep the status-based message when the response is not JSON.
    }

    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export function getJson<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  return requestJson<T>(path, { signal });
}
