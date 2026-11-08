import { useState } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { AuthLayout } from "../components/auth/AuthLayout";
import type { AuthProfile } from "../types/auth";

export function dashboardPath(profile: AuthProfile): string {
  if (
    (profile.role === "ngo" && !profile.is_approved) ||
    profile.role === "delivery_partner_pending"
  ) {
    return "/dashboard/pending";
  }

  const paths: Record<string, string> = {
    donor: "/dashboard/donor",
    ngo: "/dashboard/ngo",
    delivery_partner: "/dashboard/delivery-partner",
    admin: "/dashboard/admin",
  };
  return paths[profile.role] ?? "/dashboard/pending";
}

export function ProtectedRoute({
  role,
}: {
  role?: "donor" | "ngo" | "delivery_partner" | "admin";
}) {
  const { ready, user, profile, sessionNotice, refreshProfile } = useAuth();
  const location = useLocation();
  const [retryingProfile, setRetryingProfile] = useState(false);
  const [profileRetryError, setProfileRetryError] = useState("");

  if (!ready) {
    return (
      <AuthLayout
        eyebrow="Secure account"
        title="Checking your session."
        description="FoodBridge is verifying your sign-in with Supabase."
      >
        <div
          aria-label="Checking session"
          className="h-1.5 w-full animate-pulse rounded-full bg-sage"
          role="status"
        />
      </AuthLayout>
    );
  }

  if (!user) {
    return (
      <Navigate
        replace
        state={{
          from: { pathname: location.pathname },
          message: sessionNotice ?? undefined,
        }}
        to="/login"
      />
    );
  }

  if (!profile) {
    return (
      <AuthLayout
        eyebrow="Account setup"
        title="Profile not available yet."
        description={
          profileRetryError || sessionNotice ||
          "Your account has no FoodBridge profile. Retry setup using the registration details saved with your account."
        }
      >
        <div className="flex flex-wrap gap-3">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-forest px-5 text-sm font-semibold text-white disabled:opacity-60"
            disabled={retryingProfile}
            onClick={() => {
              setRetryingProfile(true);
              setProfileRetryError("");
              void refreshProfile(
                undefined,
                user.user_metadata?.registration,
              ).then((result) => {
                if (!result) {
                  setProfileRetryError("No saved registration details were found. Contact support for help recovering this account.");
                }
              }).catch((error: unknown) => {
                setProfileRetryError(
                  error instanceof Error ? error.message : "Profile setup failed. Please try again.",
                );
              }).finally(() => setRetryingProfile(false));
            }}
            type="button"
          >
            {retryingProfile ? "Retrying setup…" : "Retry profile setup"}
          </button>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-forest/20 px-5 text-sm font-semibold text-forest"
            to="/forgot-password"
          >
            Forgot password?
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (role && profile.role !== role) {
    return <Navigate replace to={dashboardPath(profile)} />;
  }
  if (
    profile.role === "ngo" && !profile.is_approved &&
    location.pathname !== "/dashboard/pending"
  ) {
    return <Navigate replace to="/dashboard/pending" />;
  }
  if (
    profile.role === "delivery_partner_pending" &&
    location.pathname !== "/dashboard/pending"
  ) {
    return <Navigate replace to="/dashboard/pending" />;
  }
  if (
    location.pathname === "/dashboard/pending" &&
    profile.role !== "delivery_partner_pending" &&
    !(profile.role === "ngo" && !profile.is_approved)
  ) {
    return <Navigate replace to={dashboardPath(profile)} />;
  }
  if (!role && location.pathname === "/dashboard") {
    return <Navigate replace to={dashboardPath(profile)} />;
  }
  return <Outlet />;
}
