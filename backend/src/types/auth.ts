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
  role: AppRole;
  is_approved: boolean;
  is_suspended: boolean;
}

export interface PendingApproval {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: "ngo" | "delivery_partner_pending";
  organization_name?: string | null;
  registration_number?: string | null;
  vehicle_type?: string | null;
  vehicle_number?: string | null;
}
