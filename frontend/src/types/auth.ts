import type { User } from "@supabase/supabase-js";

export type AppRole =
  | "donor"
  | "ngo"
  | "delivery_partner_pending"
  | "delivery_partner"
  | "admin";

export interface AuthProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  is_approved: boolean;
  verification_status?: "pending" | "approved" | "rejected" | null;
  verification_notes?: string | null;
}

export interface AuthProfileResponse {
  user: { id: string; email: string | null };
  profile: AuthProfile | null;
}

export interface AuthContextValue {
  ready: boolean;
  user: User | null;
  profile: AuthProfile | null;
  configError: string | null;
  sessionNotice: string | null;
  refreshProfile: (accessToken?: string) => Promise<AuthProfile | null>;
  signOut: () => Promise<void>;
}
