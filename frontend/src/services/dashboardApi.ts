import { getSupabaseClient } from "./supabaseClient";
import { requestJson } from "./apiClient";

export async function dashboardRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session expired. Please sign in again.");
  return requestJson<T>(path, {
    ...init,
    headers: {
      ...Object.fromEntries(new Headers(init.headers).entries()),
      Authorization: `Bearer ${token}`,
    },
  });
}

export function dashboardErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
