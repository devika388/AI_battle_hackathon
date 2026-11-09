import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { requestJson } from "../services/apiClient";
import type { PendingApproval } from "../types/dashboard";
import { getSupabaseClient } from "../services/supabaseClient";

export function DashboardPage({
  kind,
}: {
  kind: "donor" | "ngo" | "delivery_partner" | "admin" | "pending";
}) {
  const { profile, signOut, refreshProfile } = useAuth();
  const [logoutError, setLogoutError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [checkingStatus, setCheckingStatus] = useState(false);

  const logout = async () => {
    setLogoutError("");
    try {
      await signOut();
    } catch (error) {
      setLogoutError(
        error instanceof Error ? error.message : "We couldn't sign you out.",
      );
    }
  };

  if (!profile) {
    return (
      <main className="min-h-screen bg-cream px-5 py-12 sm:px-8">
        <section className="mx-auto max-w-2xl rounded-[2rem] bg-white p-7 shadow-soft sm:p-10">
          <p className="ds-label text-forest">Account setup</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-charcoal">
            We couldn’t load your profile.
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Your sign-in succeeded, but FoodBridge could not find a profile for
            this account. Try signing out and back in. If this continues, check
            that the Supabase auth and backend security migrations completed.
          </p>
          {logoutError ? (
            <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
              {logoutError}
            </p>
          ) : null}
          <button
            className="mt-6 min-h-11 rounded-2xl bg-forest px-5 text-sm font-semibold text-white"
            onClick={() => void logout()}
            type="button"
          >
            Sign out
          </button>
        </section>
      </main>
    );
  }
  const isPending = kind === "pending";
  const isRejected = isPending && profile.verification_status === "rejected";
  const title = isRejected
    ? "Your application was not approved."
    : isPending
    ? "Your application is being reviewed."
    : kind === "admin"
      ? "Administrator workspace"
      : `Welcome, ${profile.full_name ?? "FoodBridge partner"}.`;

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-charcoal/8 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link className="font-bold tracking-tight text-forest" to="/">
            FOODBRIDGE
          </Link>
          <button
            className="min-h-10 rounded-full border border-forest/20 px-4 text-sm font-semibold text-forest hover:bg-cream"
            onClick={() => void logout()}
            type="button"
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <section className="rounded-[2rem] bg-[#edf1e8] p-7 sm:p-10">
          <p className="ds-label text-forest">
            {isPending ? "Application status" : roleLabel(profile.role)}
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            {isRejected
              ? "An administrator reviewed your application and did not approve it."
              : isPending
              ? "This account is still marked as pending in the database. Once the self-activation migration has been applied, refresh your account status to continue."
              : kind === "admin"
                ? "Review and approve NGO and delivery partner registrations. Administrator access is assigned only through a trusted process."
                : "Your account is authenticated and your role was verified by the FoodBridge backend. Account tools will appear here as they are connected to real platform data."}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-forest">
              {isRejected
                ? "Not approved"
                : isPending
                  ? "Pending approval"
                  : "Verified account"}
            </span>
            <span className="text-sm text-slate-500">
              Signed in as {profile.email ?? "your FoodBridge account"}
            </span>
          </div>
        </section>

        {isRejected && profile.verification_notes ? (
          <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            Review note: {profile.verification_notes}
          </p>
        ) : null}

        {logoutError ? (
          <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            {logoutError}
          </p>
        ) : null}

        {kind === "admin" ? (
          <div className="mt-10">
            <AdminApprovals />
          </div>
        ) : null}

        {isPending && !isRejected ? (
          <div className="mt-7">
            <button
              className="min-h-11 rounded-2xl bg-forest px-5 text-sm font-semibold text-white disabled:opacity-60"
              disabled={checkingStatus}
              onClick={() => {
                setCheckingStatus(true);
                setStatusError("");
                void refreshProfile().then((updatedProfile) => {
                  if (updatedProfile?.role === profile.role &&
                    (updatedProfile.role === "delivery_partner_pending" ||
                      (updatedProfile.role === "ngo" && !updatedProfile.is_approved))) {
                    setStatusError("The account is still pending. Apply the self-activation migration in Supabase, then check again.");
                  }
                }).catch((error: unknown) => {
                  setStatusError(
                    error instanceof Error ? error.message : "Could not refresh account status.",
                  );
                }).finally(() => setCheckingStatus(false));
              }}
              type="button"
            >
              {checkingStatus ? "Checking…" : "Refresh account status"}
            </button>
            {statusError ? (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
                {statusError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    donor: "Donor workspace",
    ngo: "NGO workspace",
    delivery_partner: "Delivery partner workspace",
    admin: "Admin workspace",
  };
  return labels[role] ?? "FoodBridge workspace";
}

function AdminApprovals() {
  const { user, signOut } = useAuth();
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const loadApprovals = useCallback(async () => {
    const { data, error } = await getSupabaseClient().auth.getSession();
    if (error) throw error;
    const token = data.session?.access_token;
    if (!token) {
      await signOut();
      throw new Error("Your session expired. Please sign in again.");
    }
    const result = await requestJson<{ approvals: PendingApproval[] }>(
      "/admin/approvals",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    setApprovals(result.approvals);
  }, [signOut]);

  useEffect(() => {
    let active = true;
    void loadApprovals()
      .catch((error: unknown) => {
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "We couldn't load approval requests.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadApprovals]);

  const approve = async (item: PendingApproval) => {
    if (!user) return;
    setBusyUserId(item.user_id);
    setErrorMessage("");
    try {
      const { data, error } = await getSupabaseClient().auth.getSession();
      if (error) throw error;
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session expired. Please sign in again.");
      await requestJson(`/admin/approvals/${item.user_id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setApprovals((current) =>
        current.filter((approval) => approval.user_id !== item.user_id),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We couldn't approve this account.",
      );
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <section aria-labelledby="approvals-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="ds-label text-forest">Trusted review</p>
          <h2 className="mt-2 text-2xl font-semibold" id="approvals-heading">
            Pending applications
          </h2>
        </div>
        <button
          className="min-h-10 rounded-full border border-forest/20 bg-white px-4 text-sm font-semibold text-forest hover:bg-cream"
          onClick={() => {
            setLoading(true);
            setErrorMessage("");
            void loadApprovals()
              .catch((error: unknown) =>
                setErrorMessage(
                  error instanceof Error ? error.message : "Refresh failed.",
                ),
              )
              .finally(() => setLoading(false));
          }}
          type="button"
        >
          Refresh
        </button>
      </div>

      {errorMessage ? (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Loading applications…</p>
      ) : approvals.length ? (
        <div className="mt-6 grid gap-4">
          {approvals.map((item) => (
            <article
              className="rounded-2xl border border-charcoal/10 bg-white p-5 shadow-card sm:flex sm:items-center sm:justify-between sm:gap-6"
              key={item.user_id}
            >
              <div>
                <p className="font-semibold text-charcoal">
                  {item.organization_name ?? item.full_name ?? "Application"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {item.role === "ngo" ? "NGO" : "Delivery partner"} ·{" "}
                  {item.full_name ?? "No contact name"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {item.email} {item.phone ? `· ${item.phone}` : ""}
                </p>
                {item.registration_number ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Registration: {item.registration_number}
                  </p>
                ) : null}
                {item.vehicle_type ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Vehicle: {item.vehicle_type} · {item.vehicle_number}
                  </p>
                ) : null}
              </div>
              <button
                className="mt-4 min-h-10 rounded-full bg-forest px-5 text-sm font-semibold text-white hover:bg-[#294b39] disabled:opacity-50 sm:mt-0"
                disabled={busyUserId === item.user_id}
                onClick={() => void approve(item)}
                type="button"
              >
                {busyUserId === item.user_id ? "Approving…" : "Approve"}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-charcoal/15 bg-white p-8 text-center text-sm text-slate-500">
          There are no pending applications.
        </div>
      )}
    </section>
  );
}

export function RegistrationPendingPage() {
  return <DashboardPage kind="pending" />;
}
