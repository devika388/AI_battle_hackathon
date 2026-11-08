import { getSupabaseAdmin } from "./supabaseAdmin.js";
import { failDatabase } from "./domainCommon.js";
import { HttpError } from "../utils/HttpError.js";

export async function listNotifications(
  userId: string,
  limit: number,
  offset: number,
) {
  const { data, error } = await getSupabaseAdmin()
    .from("notifications")
    .select("id, title, message, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) failDatabase(error, "Could not load notifications:");
  return data ?? [];
}

export async function getUnreadNotificationCount(userId: string) {
  const { count, error } = await getSupabaseAdmin()
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) failDatabase(error, "Could not count unread notifications:");
  return count ?? 0;
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .select("id, is_read")
    .maybeSingle();
  if (error) failDatabase(error, "Could not mark notification as read:");
  if (!data) throw new HttpError("Notification not found.", 404);
  return data;
}

export async function markAllNotificationsRead(userId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false)
    .select("id");
  if (error) failDatabase(error, "Could not mark notifications as read:");
  return { updated: data?.length ?? 0 };
}
