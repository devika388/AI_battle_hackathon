export interface Donation {
  id: string;
  donor_id: string;
  food_name: string;
  description: string | null;
  food_category: string;
  quantity: number;
  quantity_unit: string;
  pickup_address: string;
  city: string | null;
  pincode: string | null;
  preparation_time: string | null;
  expiry_time: string;
  image_url: string | null;
  status: string;
  created_at: string;
  assignment?: DonationAssignment | null;
}

export interface DonationAssignment {
  id: string;
  donation_id: string;
  ngo_id: string | null;
  partner_id: string | null;
  status: string;
  assigned_at: string;
  ngo_profiles?: { organization_name: string | null } | null;
  partner_profiles?: {
    vehicle_type: string | null;
    vehicle_number: string | null;
  } | null;
}

export interface DonationDetails extends Donation {
  status_events: {
    status: string | null;
    description: string | null;
    updated_at: string;
    responsible_user_id?: string | null;
    responsible_user?: { full_name: string | null } | null;
    location?: string | null;
  }[];
  assignment: DonationAssignment | null;
  delivery_proofs?: {
    id: string;
    notes: string | null;
    receiver_name?: string | null;
    delivered_at: string;
  }[];
  matches?: {
    match_score: number | null;
    match_reason: string | null;
    status: string;
    ngo_profiles?: { organization_name: string | null } | null;
  }[];
}

export interface NgoMatch {
  donation: Donation;
  match_score: number;
  match_reason: string;
  score_components: {
    location: number;
    food_requirements: number;
    capacity: number;
    handling_time: number;
  };
  distance_km: number | null;
}

export interface NotificationItem {
  id: string;
  title: string | null;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ImpactTotals {
  donations: number;
  food_saved_kg: number;
  meals_provided: number;
  co2_saved_kg: number;
}

export interface NgoProfileDetails {
  organization_name: string | null;
  registration_number: string | null;
  address: string | null;
  city: string | null;
  is_verified: boolean;
  preferred_categories: string[];
  max_daily_quantity: number | null;
  capacity_unit: string | null;
}
