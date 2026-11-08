import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

export type DashboardTab =
  | "overview"
  | "create"
  | "donations"
  | "history"
  | "notifications"
  | "impact"
  | "profile"
  | "available"
  | "accepted"
  | "deliveries"
  | "assignments"
  | "users"
  | "donors"
  | "ngos"
  | "partners"
  | "adminDonations"
  | "adminAssignments"
  | "requests"
  | "reports"
  | "settings";

const donorNav: { label: string; tab: DashboardTab }[] = [
  { label: "Overview", tab: "overview" },
  { label: "Create Donation", tab: "create" },
  { label: "My Donations", tab: "donations" },
  { label: "Donation History", tab: "history" },
  { label: "Notifications", tab: "notifications" },
  { label: "Impact", tab: "impact" },
  { label: "Profile", tab: "profile" },
];

const ngoNav: { label: string; tab: DashboardTab }[] = [
  { label: "Overview", tab: "overview" },
  { label: "Available Donations", tab: "available" },
  { label: "My Accepted Donations", tab: "accepted" },
  { label: "Active Deliveries", tab: "deliveries" },
  { label: "Donation History", tab: "history" },
  { label: "Notifications", tab: "notifications" },
  { label: "Impact", tab: "impact" },
  { label: "Profile", tab: "profile" },
];

const partnerNav: { label: string; tab: DashboardTab }[] = [
  { label: "Overview", tab: "overview" },
  { label: "Available Assignments", tab: "available" },
  { label: "My Deliveries", tab: "assignments" },
  { label: "Completed Deliveries", tab: "history" },
  { label: "Notifications", tab: "notifications" },
  { label: "Profile", tab: "profile" },
];

const adminNav: { label: string; tab: DashboardTab }[] = [
  { label: "Overview", tab: "overview" },
  { label: "Users", tab: "users" },
  { label: "Donors", tab: "donors" },
  { label: "NGOs", tab: "ngos" },
  { label: "Delivery Partners", tab: "partners" },
  { label: "Donations", tab: "adminDonations" },
  { label: "Assignments", tab: "adminAssignments" },
  { label: "Rescue Management", tab: "requests" },
  { label: "Reports", tab: "reports" },
  { label: "Notifications", tab: "notifications" },
  { label: "Settings", tab: "settings" },
];

type DashboardRole = "donor" | "ngo" | "delivery_partner" | "admin";

function navFor(role: DashboardRole) {
  if (role === "donor") return donorNav;
  if (role === "ngo") return ngoNav;
  if (role === "delivery_partner") return partnerNav;
  return adminNav;
}

export function useDashboardTab(
  role: DashboardRole,
  defaultTab: DashboardTab = "overview",
) {
  const [params, setParams] = useSearchParams();
  const tabValue = params.get("tab") as DashboardTab | null;
  const allowed = navFor(role).some((item) => item.tab === tabValue);
  const tab = allowed ? tabValue! : defaultTab;
  const selectTab = (next: DashboardTab) => {
    const updated = new URLSearchParams(params);
    if (next === "overview") updated.delete("tab");
    else updated.set("tab", next);
    setParams(updated);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return { tab, selectTab };
}

export function DashboardShell({
  role,
  activeTab,
  onTabChange,
  children,
}: {
  role: DashboardRole;
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  children: ReactNode;
}) {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const items = navFor(role);
  const roleTitle = {
    donor: "Donor workspace",
    ngo: "NGO workspace",
    delivery_partner: "Delivery partner workspace",
    admin: "Admin workspace",
  }[role];

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

  return (
    <div className="min-h-screen bg-[#f7f6f0]">
      <header className="sticky top-0 z-30 border-b border-charcoal/8 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex h-[4.5rem] max-w-[90rem] items-center justify-between gap-4 px-4 sm:px-7">
          <div className="flex items-center gap-3">
            <Link className="text-xl font-bold tracking-tight text-forest" to="/">
              FoodBridge<span className="text-sage">.</span>
            </Link>
            <span className="hidden border-l border-charcoal/15 pl-3 text-xs font-medium text-slate-500 sm:block">
              {roleTitle}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-charcoal">
                {profile?.full_name ?? "FoodBridge partner"}
              </p>
              <p className="text-xs text-slate-500">{profile?.email}</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#e6efe3] text-sm font-bold text-forest">
              {(profile?.full_name ?? "F").charAt(0).toUpperCase()}
            </div>
            <button
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close dashboard menu" : "Open dashboard menu"}
              className="grid h-10 w-10 place-items-center rounded-xl border border-charcoal/10 bg-white text-forest lg:hidden"
              onClick={() => setMobileOpen((open) => !open)}
              type="button"
            >
              <span aria-hidden="true">{mobileOpen ? "×" : "☰"}</span>
            </button>
            <button
              className="hidden min-h-10 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-white hover:text-forest sm:inline-flex"
              onClick={() => void logout()}
              type="button"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[90rem] gap-5 px-4 py-5 sm:px-7 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 lg:py-8">
        <aside
          aria-label={`${roleTitle} navigation`}
          className={`${mobileOpen ? "block" : "hidden"} h-fit rounded-2xl border border-charcoal/8 bg-white p-3 shadow-card lg:sticky lg:top-24 lg:block`}
        >
          <p className="px-3 pb-3 pt-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-400">
            {roleTitle}
          </p>
          <nav className="space-y-1">
            {items.map((item, index) => {
              const active = activeTab === item.tab;
              return (
                <button
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium ${active ? "bg-[#eaf0e7] text-forest" : "text-slate-600 hover:bg-cream hover:text-forest"}`}
                  key={item.tab}
                  onClick={() => {
                    onTabChange(item.tab);
                    setMobileOpen(false);
                  }}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className={`grid h-7 w-7 place-items-center rounded-lg text-xs ${active ? "bg-white" : "bg-[#f5f5f1]"}`}
                  >
                    {["◫", "＋", "▤", "◷", "◉", "✳", "○", "⌕", "✓"][index % 9]}
                  </span>
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="mt-4 border-t border-charcoal/8 pt-3 sm:hidden">
            <button
              className="min-h-11 w-full rounded-xl px-3 text-left text-sm font-semibold text-slate-600 hover:bg-cream"
              onClick={() => void logout()}
              type="button"
            >
              Log out
            </button>
          </div>
        </aside>

        <main className="min-w-0">
          {logoutError ? (
            <p className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
              {logoutError}
            </p>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}

export function DashboardHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="ds-label text-forest">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-charcoal sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function DashboardState({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading?: boolean;
  error?: string;
  empty?: boolean;
  onRetry?: () => void;
}) {
  if (loading === true) {
    return (
      <div className="ds-card flex min-h-40 items-center justify-center p-8">
        <div className="flex items-center gap-3 text-sm text-slate-500" role="status">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-sage border-t-forest" />
          Loading live FoodBridge data…
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800" role="alert">
        <p className="font-semibold">We couldn’t load this section.</p>
        <p className="mt-1 leading-6">{error}</p>
        {onRetry ? (
          <button
            className="mt-3 rounded-xl border border-red-200 bg-white px-4 py-2 font-semibold"
            onClick={onRetry}
            type="button"
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  }
  if (empty) {
    return (
      <div className="ds-card flex min-h-44 flex-col items-center justify-center p-8 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eaf0e7] text-xl text-forest">
          ♧
        </span>
        <p className="mt-4 font-semibold text-charcoal">Nothing here yet</p>
        <p className="mt-1 text-sm text-slate-500">
          New activity will appear here as it happens.
        </p>
      </div>
    );
  }
  return null;
}

export function StatCard({
  label,
  value,
  note,
  tone = "sage",
}: {
  label: string;
  value: string | number;
  note?: string;
  tone?: "sage" | "butter" | "powder" | "blush";
}) {
  const styles = {
    sage: "bg-[#eaf0e7]",
    butter: "bg-[#fbf3d9]",
    powder: "bg-[#e7f0f3]",
    blush: "bg-[#f7e9e6]",
  };
  return (
    <div className={`rounded-2xl p-4 sm:p-5 ${styles[tone]}`}>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-charcoal">
        {value}
      </p>
      {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
    </div>
  );
}
