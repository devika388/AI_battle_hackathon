import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge, Button, Card, InputField } from "../../components/ui";
import { FoodPassport } from "../../components/FoodPassport";
import { useAuth } from "../../auth/AuthContext";
import {
  dashboardErrorMessage,
  dashboardRequest,
} from "../../services/dashboardApi";
import type {
  Donation,
  DonationAssignment,
  DonationDetails,
  ImpactTotals,
  NgoMatch,
  NgoProfileDetails,
  NotificationItem,
} from "../../types/food";
import {
  DashboardHeading,
  DashboardShell,
  DashboardState,
  StatCard,
  useDashboardTab,
} from "./DashboardShell";

const foodCategories = [
  { value: "cooked_meals", label: "Cooked meals" },
  { value: "fruits", label: "Fruits" },
  { value: "vegetables", label: "Vegetables" },
  { value: "bakery", label: "Bakery" },
  { value: "dairy", label: "Dairy" },
  { value: "packaged_food", label: "Packaged food" },
  { value: "other", label: "Other" },
];

const statusTone: Record<string, "forest" | "sage" | "butter" | "powder" | "neutral" | "danger"> = {
  available: "sage",
  matched: "powder",
  accepted: "powder",
  assigned: "butter",
  picked_up: "butter",
  delivered: "forest",
  completed: "forest",
  cancelled: "danger",
  expired: "neutral",
};

function pretty(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

interface AcceptedRecord extends DonationAssignment {
  donations: Donation | null;
}

export function NgoDashboard() {
  const { donationId } = useParams();
  const { tab, selectTab } = useDashboardTab("ngo");
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<NgoMatch[]>([]);
  const [accepted, setAccepted] = useState<AcceptedRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [impact, setImpact] = useState<ImpactTotals | null>(null);
  const [ngoProfile, setNgoProfile] = useState<NgoProfileDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [matchResult, acceptedResult, notificationResult, impactResult, profileResult] =
        await Promise.all([
          dashboardRequest<{ matches: NgoMatch[] }>("/ngo/donations/matching?limit=100"),
          dashboardRequest<{ assignments: AcceptedRecord[] }>("/ngo/donations/accepted?limit=100"),
          dashboardRequest<{ notifications: NotificationItem[] }>("/notifications?limit=50"),
          dashboardRequest<{ impact: ImpactTotals }>("/impact"),
          dashboardRequest<{ profile: { ngo?: NgoProfileDetails } }>("/profile"),
        ]);
      setMatches(matchResult.matches);
      setAccepted(acceptedResult.assignments);
      setNotifications(notificationResult.notifications);
      setImpact(impactResult.impact);
      setNgoProfile(profileResult.profile.ngo ?? null);
    } catch (error) {
      setLoadError(dashboardErrorMessage(error, "Unable to load NGO data."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const stats = useMemo(() => {
    const active = accepted.filter((item) => ["assigned", "picked_up"].includes(item.status));
    const delivered = accepted.filter((item) => item.status === "delivered");
    const completed = accepted.filter((item) => item.status === "completed");
    const receivedByUnit = new Map<string, number>();
    for (const item of completed) {
      if (!item.donations) continue;
      const unit = item.donations.quantity_unit;
      receivedByUnit.set(
        unit,
        (receivedByUnit.get(unit) ?? 0) + Number(item.donations.quantity),
      );
    }
    return {
      available: matches.length,
      accepted: accepted.length,
      active: active.length,
      completed: completed.length,
      received: [...receivedByUnit]
        .map(([unit, quantity]) => `${quantity.toLocaleString()} ${unit}`)
        .join(" · ") || "0",
      deliveredAwaitingReceipt: delivered.length,
    };
  }, [accepted, matches]);

  if (donationId) {
    return (
      <DashboardShell
        role="ngo"
        activeTab="available"
        onTabChange={(next) => navigate(
          next === "overview" ? "/dashboard/ngo" : `/dashboard/ngo?tab=${next}`,
        )}
      >
        <NgoDonationDetails
          donationId={donationId}
          onBack={() => navigate("/dashboard/ngo?tab=available")}
          onAccepted={loadDashboard}
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role="ngo" activeTab={tab} onTabChange={selectTab}>
      {tab === "overview" ? (
        <Overview
          organization={ngoProfile?.organization_name ?? "your organization"}
          matches={matches}
          accepted={accepted}
          stats={stats}
          impact={impact}
          loading={loading}
          error={loadError}
          onRetry={loadDashboard}
          onExplore={() => selectTab("available")}
          onOpen={(id) => navigate(`/dashboard/ngo/donations/${id}`)}
        />
      ) : null}
      {tab === "available" ? (
        <AvailableDonations
          matches={matches}
          loading={loading}
          error={loadError}
          onRetry={loadDashboard}
          onChanged={loadDashboard}
          onOpen={(id) => navigate(`/dashboard/ngo/donations/${id}`)}
        />
      ) : null}
      {tab === "accepted" || tab === "deliveries" || tab === "history" ? (
        <AcceptedDonations
          records={accepted}
          mode={tab}
          loading={loading}
          error={loadError}
          onRetry={loadDashboard}
          onChanged={loadDashboard}
          onOpen={(id) => navigate(`/dashboard/ngo/donations/${id}`)}
        />
      ) : null}
      {tab === "notifications" ? (
        <NgoNotifications
          items={notifications}
          loading={loading}
          error={loadError}
          onRetry={loadDashboard}
          onRead={(id) => setNotifications((current) => current.map((item) =>
            item.id === id ? { ...item, is_read: true } : item,
          ))}
        />
      ) : null}
      {tab === "impact" ? <NgoImpact impact={impact} loading={loading} error={loadError} onRetry={loadDashboard} /> : null}
      {tab === "profile" ? (
        <NgoProfile
          profile={ngoProfile}
          email={profile?.email ?? ""}
          fullName={profile?.full_name ?? ""}
          phone={profile?.phone ?? ""}
          onSaved={(next) => setNgoProfile(next)}
        />
      ) : null}
    </DashboardShell>
  );
}

function Overview({
  organization,
  matches,
  accepted,
  stats,
  impact,
  loading,
  error,
  onRetry,
  onExplore,
  onOpen,
}: {
  organization: string;
  matches: NgoMatch[];
  accepted: AcceptedRecord[];
  stats: { available: number; accepted: number; active: number; completed: number; received: string; deliveredAwaitingReceipt: number };
  impact: ImpactTotals | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onExplore: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <>
      <DashboardHeading
        eyebrow="Community food access"
        title={`Welcome, ${organization}.`}
        description="Find nearby surplus food, coordinate each pickup, and confirm what reaches your community."
        action={<Button onClick={onExplore}>Explore available food</Button>}
      />
      {loading || error ? <DashboardState loading={loading} error={error} onRetry={onRetry} /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Available food" value={stats.available} note="Live NGO matches" />
            <StatCard label="Accepted donations" value={stats.accepted} note="Your active and past assignments" tone="powder" />
            <StatCard label="Active deliveries" value={stats.active} note="Assigned or picked up" tone="butter" />
            <StatCard label="Completed deliveries" value={stats.completed} note="Receipt confirmed" tone="blush" />
            <StatCard label="Meals distributed" value={Number(impact?.meals_provided ?? 0).toLocaleString()} note="Recorded platform impact" tone="sage" />
            <StatCard label="Food received" value={stats.received} note="Confirmed deliveries" tone="powder" />
          </div>
          {stats.deliveredAwaitingReceipt ? (
            <div className="mt-5 rounded-2xl border border-[#e6d9aa] bg-[#fbf3d9] p-4 text-sm text-[#68551e]">
              <span className="font-semibold">{stats.deliveredAwaitingReceipt} delivery{stats.deliveredAwaitingReceipt === 1 ? "" : "ies"} need your receipt confirmation.</span>
              <span> Open My Accepted Donations to confirm.</span>
            </div>
          ) : null}
          <section className="mt-6 grid gap-5 xl:grid-cols-2">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-charcoal/8 px-5 py-4">
                <div>
                  <h2 className="font-semibold">Best current matches</h2>
                  <p className="mt-1 text-xs text-slate-500">Ranked with an explainable rules-based score</p>
                </div>
                <button className="text-sm font-semibold text-forest hover:underline" onClick={onExplore} type="button">View all</button>
              </div>
              {!matches.length ? <DashboardState empty /> : (
                <div className="divide-y divide-charcoal/8">
                  {matches.slice(0, 4).map((match) => (
                    <button className="flex w-full items-center gap-3 p-4 text-left hover:bg-cream/60" key={match.donation.id} onClick={() => onOpen(match.donation.id)} type="button">
                      <FoodThumb donation={match.donation} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{match.donation.food_name}</span>
                        <span className="mt-1 block text-xs text-slate-500">{match.donation.quantity} {match.donation.quantity_unit} · {match.donation.city}</span>
                      </span>
                      <Badge tone="sage">{match.match_score}%</Badge>
                    </button>
                  ))}
                </div>
              )}
            </Card>
            <Card className="overflow-hidden">
              <div className="border-b border-charcoal/8 px-5 py-4">
                <h2 className="font-semibold">Incoming deliveries</h2>
                <p className="mt-1 text-xs text-slate-500">Updates for accepted donations</p>
              </div>
              {!accepted.length ? <DashboardState empty /> : (
                <div className="divide-y divide-charcoal/8">
                  {accepted.slice(0, 4).map((item) => item.donations ? (
                    <button className="flex w-full items-center gap-3 p-4 text-left hover:bg-cream/60" key={item.id} onClick={() => onOpen(item.donation_id)} type="button">
                      <FoodThumb donation={item.donations} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{item.donations.food_name}</span>
                        <span className="mt-1 block text-xs text-slate-500">Updated {dateLabel(item.assigned_at)}</span>
                      </span>
                      <Badge tone={statusTone[item.status] ?? "neutral"}>{pretty(item.status)}</Badge>
                    </button>
                  ) : null)}
                </div>
              )}
            </Card>
          </section>
        </>
      )}
    </>
  );
}

function FoodThumb({ donation }: { donation: Donation }) {
  return donation.image_url ? (
    <img alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" src={donation.image_url} />
  ) : (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#eaf0e7] text-forest">✳</span>
  );
}

function AvailableDonations({
  matches,
  loading,
  error,
  onRetry,
  onChanged,
  onOpen,
}: {
  matches: NgoMatch[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onChanged: () => void;
  onOpen: (id: string) => void;
}) {
  const [category, setCategory] = useState("all");
  const [location, setLocation] = useState("");
  const [minimumQuantity, setMinimumQuantity] = useState("");
  const [expiryWithin, setExpiryWithin] = useState("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [actionError, setActionError] = useState("");
  const filtered = matches.filter(({ donation }) => {
    const text = `${donation.food_name} ${donation.id} ${donation.city ?? ""} ${donation.food_category}`.toLowerCase();
    const remainingHours = (new Date(donation.expiry_time).getTime() - Date.now()) / 3_600_000;
    return (
      (category === "all" || donation.food_category.toLowerCase().replace(/[\s-]+/g, "_") === category) &&
      (!location || `${donation.city ?? ""} ${donation.pickup_address}`.toLowerCase().includes(location.toLowerCase())) &&
      (!minimumQuantity || Number(donation.quantity) >= Number(minimumQuantity)) &&
      (expiryWithin === "all" || remainingHours <= Number(expiryWithin)) &&
      (!search || text.includes(search.toLowerCase()))
    );
  });

  const takeAction = async (id: string, action: "accept" | "decline") => {
    setBusyId(id);
    setActionError("");
    try {
      await dashboardRequest(`/ngo/donations/${id}/${action}`, { method: "POST" });
      await onChanged();
    } catch (actionFailure) {
      setActionError(dashboardErrorMessage(actionFailure, `Could not ${action} this donation.`));
    } finally {
      setBusyId("");
    }
  };

  return (
    <>
      <DashboardHeading
        eyebrow="Available near your community"
        title="Find food to rescue"
        description="Browse available donations and see exactly how each match score was calculated."
      />
      <Card className="mb-5 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <input aria-label="Search available donations" className="ds-field" onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Search food or ID" value={search} />
          <select aria-label="Food category" className="ds-field" onChange={(event) => setCategory(event.currentTarget.value)} value={category}>
            <option value="all">All categories</option>
            {foodCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <input aria-label="Filter by location" className="ds-field" onChange={(event) => setLocation(event.currentTarget.value)} placeholder="City or location" value={location} />
          <input aria-label="Minimum quantity" className="ds-field" min="0" onChange={(event) => setMinimumQuantity(event.currentTarget.value)} placeholder="Minimum quantity" type="number" value={minimumQuantity} />
          <select aria-label="Expiry filter" className="ds-field" onChange={(event) => setExpiryWithin(event.currentTarget.value)} value={expiryWithin}>
            <option value="all">Any expiry</option>
            <option value="24">Expires within 24 hours</option>
            <option value="8">Expires within 8 hours</option>
            <option value="4">Expires within 4 hours</option>
          </select>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">Distance is not shown because the current FoodBridge database stores city and address, but not map coordinates.</p>
      </Card>
      {actionError ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{actionError}</p> : null}
      {loading || error ? <DashboardState loading={loading} error={error} onRetry={onRetry} /> : !filtered.length ? <DashboardState empty /> : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((match) => (
            <DonationMatchCard
              key={match.donation.id}
              match={match}
              busy={busyId === match.donation.id}
              onAccept={() => void takeAction(match.donation.id, "accept")}
              onDecline={() => void takeAction(match.donation.id, "decline")}
              onOpen={() => onOpen(match.donation.id)}
            />
          ))}
        </div>
      )}
      <Card className="mt-5 bg-[#f1f4ee] p-5">
        <h2 className="text-sm font-semibold">How matching works</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">This is a transparent rules-based ranking, not a trained AI model: same city (35 points), preferred category (25; neutral 15 if unset), daily capacity fit in a matching unit (25; neutral 15 if unset or units differ), and remaining handling time (15 for 4+ hours, 8 for 2–4 hours). Scores total at most 100. Exact distance cannot be calculated until map coordinates are part of the project data.</p>
      </Card>
    </>
  );
}

function DonationMatchCard({
  match,
  busy,
  onAccept,
  onDecline,
  onOpen,
}: {
  match: NgoMatch;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onOpen: () => void;
}) {
  const { donation } = match;
  return (
    <Card className="overflow-hidden">
      {donation.image_url ? <img alt={donation.food_name} className="h-44 w-full object-cover" src={donation.image_url} /> : null}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="ds-label text-forest">{pretty(donation.food_category)}</p>
            <h2 className="mt-1 truncate text-lg font-semibold">{donation.food_name}</h2>
            <p className="mt-1 text-sm text-slate-600">{donation.quantity} {donation.quantity_unit}</p>
          </div>
          <div className="rounded-2xl bg-[#eaf0e7] px-3 py-2 text-center">
            <p className="text-xl font-bold text-forest">{match.match_score}</p>
            <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-forest">Match</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 rounded-xl bg-[#f7f6f0] p-3 text-sm sm:grid-cols-2">
          <p><span className="block text-xs text-slate-500">Pickup location</span><span className="mt-1 block font-medium">{donation.city ?? "City not provided"} · {donation.pickup_address}</span></p>
          <p><span className="block text-xs text-slate-500">Expires</span><span className="mt-1 block font-medium">{dateLabel(donation.expiry_time)}</span></p>
          <p><span className="block text-xs text-slate-500">Distance</span><span className="mt-1 block font-medium">{match.distance_km == null ? "Unavailable (no coordinates)" : `${match.distance_km.toFixed(1)} km`}</span></p>
          <p><span className="block text-xs text-slate-500">Donation ID</span><span className="mt-1 block truncate font-mono text-xs">{donation.id}</span></p>
        </div>
        <details className="mt-4 rounded-xl border border-charcoal/8 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-forest">Why this match? {match.match_score}/100</summary>
          <p className="mt-2 text-xs leading-5 text-slate-600">{match.match_reason}</p>
        </details>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={busy} onClick={onAccept} size="sm">{busy ? "Saving…" : "Accept donation"}</Button>
          <Button disabled={busy} onClick={onDecline} size="sm" variant="secondary">Decline match</Button>
          <Button onClick={onOpen} size="sm" variant="ghost">Details</Button>
        </div>
      </div>
    </Card>
  );
}

function AcceptedDonations({
  records,
  mode,
  loading,
  error,
  onRetry,
  onChanged,
  onOpen,
}: {
  records: AcceptedRecord[];
  mode: "accepted" | "deliveries" | "history";
  loading: boolean;
  error: string;
  onRetry: () => void;
  onChanged: () => void;
  onOpen: (id: string) => void;
}) {
  const [busyId, setBusyId] = useState("");
  const [actionError, setActionError] = useState("");
  const filtered = records.filter((item) => {
    if (mode === "deliveries") return ["assigned", "picked_up", "delivered"].includes(item.status);
    if (mode === "history") return item.status === "completed";
    return true;
  });
  const confirmReceipt = async (assignmentId: string) => {
    setBusyId(assignmentId);
    setActionError("");
    try {
      await dashboardRequest(`/ngo/assignments/${assignmentId}/confirm-receipt`, { method: "POST" });
      await onChanged();
    } catch (error) {
      setActionError(dashboardErrorMessage(error, "Could not confirm receipt."));
    } finally {
      setBusyId("");
    }
  };

  const heading = mode === "deliveries" ? "Active deliveries" : mode === "history" ? "Donation history" : "My accepted donations";
  return (
    <>
      <DashboardHeading eyebrow="Your commitments" title={heading} description="Track accepted donations and confirm receipt after a delivery is complete." />
      {actionError ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{actionError}</p> : null}
      {loading || error ? <DashboardState loading={loading} error={error} onRetry={onRetry} /> : !filtered.length ? <DashboardState empty /> : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <Card className="p-4 sm:p-5" key={item.id}>
              <div className="flex flex-wrap items-center gap-4">
                {item.donations ? <FoodThumb donation={item.donations} /> : null}
                <div className="min-w-[12rem] flex-1">
                  <h2 className="font-semibold">{item.donations?.food_name ?? "Donation"}</h2>
                  <p className="mt-1 text-sm text-slate-600">{item.donations ? `${item.donations.quantity} ${item.donations.quantity_unit} · ${item.donations.city ?? item.donations.pickup_address}` : "Donation details unavailable"}</p>
                  <p className="mt-1 truncate font-mono text-[0.68rem] text-slate-400">{item.donation_id}</p>
                </div>
                <Badge tone={statusTone[item.status] ?? "neutral"}>{pretty(item.status)}</Badge>
                <div className="flex gap-2">
                  {item.donations ? <Button onClick={() => onOpen(item.donation_id)} size="sm" variant="secondary">Details</Button> : null}
                  {item.status === "delivered" ? (
                    <Button disabled={busyId === item.id} onClick={() => void confirmReceipt(item.id)} size="sm">
                      {busyId === item.id ? "Confirming…" : "Confirm receipt"}
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function NgoDonationDetails({
  donationId,
  onBack,
  onAccepted,
}: {
  donationId: string;
  onBack: () => void;
  onAccepted: () => void;
}) {
  const [donation, setDonation] = useState<DonationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await dashboardRequest<{ donation: DonationDetails }>(`/donations/${donationId}`);
      setDonation(result.donation);
    } catch (loadError) {
      setError(dashboardErrorMessage(loadError, "Could not load donation details."));
    } finally {
      setLoading(false);
    }
  }, [donationId]);
  useEffect(() => { void load(); }, [load]);
  const accept = async () => {
    setBusy(true);
    setActionError("");
    try {
      await dashboardRequest(`/ngo/donations/${donationId}/accept`, { method: "POST" });
      await onAccepted();
      await load();
    } catch (acceptError) {
      setActionError(dashboardErrorMessage(acceptError, "Could not accept donation."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <DashboardHeading eyebrow="Donation details" title={donation?.food_name ?? "Food passport"} description="Review the food and pickup information before deciding." action={<Button onClick={onBack} variant="secondary">← Available donations</Button>} />
      {actionError ? <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-800" role="alert">{actionError}</p> : null}
      <DashboardState loading={loading} error={error} onRetry={() => void load()} />
      {donation ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(17rem,0.7fr)]">
          <div className="space-y-5">
            <Card className="overflow-hidden">
              {donation.image_url ? <img alt={donation.food_name} className="h-64 w-full object-cover" src={donation.image_url} /> : null}
              <div className="p-5 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Badge tone={statusTone[donation.status] ?? "neutral"}>{pretty(donation.status)}</Badge>
                  <span className="font-mono text-xs text-slate-400">{donation.id}</span>
                </div>
                <h2 className="mt-4 text-xl font-semibold">{donation.food_name}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{donation.description || "No description provided."}</p>
                <div className="mt-5 grid gap-4 border-t border-charcoal/8 pt-4 sm:grid-cols-2">
                  <Detail label="Quantity" value={`${donation.quantity} ${donation.quantity_unit}`} />
                  <Detail label="Category" value={pretty(donation.food_category)} />
                  <Detail label="Prepared at" value={dateLabel(donation.preparation_time)} />
                  <Detail label="Expires" value={dateLabel(donation.expiry_time)} />
                  <Detail label="Pickup" value={`${donation.pickup_address}, ${donation.city ?? ""} ${donation.pincode ?? ""}`} />
                </div>
              </div>
            </Card>
            <FoodPassport
              donationId={donation.id}
              donationStatus={donation.status}
              events={donation.status_events ?? []}
            />
          </div>
          <div className="space-y-5">
            <Card className="p-5">
              <h2 className="font-semibold">Pickup planning</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{donation.pickup_address}, {donation.city ?? ""} {donation.pincode ?? ""}</p>
              <p className="mt-3 text-xs text-slate-500">Preparation: {dateLabel(donation.preparation_time)}</p>
              <p className="mt-1 text-xs text-slate-500">Expiry: {dateLabel(donation.expiry_time)}</p>
            </Card>
            {donation.status === "available" ? (
              <Card className="bg-[#f1f4ee] p-5">
                <p className="text-sm leading-6 text-slate-600">Accepting creates a single delivery assignment, updates donation status, and notifies the donor.</p>
                <Button className="mt-4 w-full" disabled={busy} onClick={() => void accept()}>{busy ? "Accepting…" : "Accept donation"}</Button>
              </Card>
            ) : null}
            {donation.delivery_proofs?.length ? (
              <Card className="p-5">
                <h2 className="font-semibold">Delivery proof</h2>
                {donation.delivery_proofs.map((proof) => (
                  <p className="mt-3 text-sm text-slate-600" key={proof.id}>{dateLabel(proof.delivered_at)}{proof.notes ? ` · ${proof.notes}` : ""}</p>
                ))}
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value}</p></div>;
}

function NgoNotifications({
  items,
  loading,
  error,
  onRetry,
  onRead,
}: {
  items: NotificationItem[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onRead: (id: string) => void;
}) {
  const [actionError, setActionError] = useState("");
  const markRead = async (id: string) => {
    try {
      await dashboardRequest(`/notifications/${id}/read`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_read: true }) });
      onRead(id);
    } catch (error) {
      setActionError(dashboardErrorMessage(error, "Could not update notification."));
    }
  };
  return (
    <>
      <DashboardHeading eyebrow="Stay up to date" title="Notifications" description="Keep up with new matches and delivery activity." />
      {actionError ? <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{actionError}</p> : null}
      {loading || error ? <DashboardState loading={loading} error={error} onRetry={onRetry} /> : !items.length ? <DashboardState empty /> : (
        <div className="space-y-3">{items.map((item) => (
          <Card className="flex items-start gap-4 p-4 sm:p-5" key={item.id}>
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.is_read ? "bg-slate-200" : "bg-forest"}`} />
            <div className="min-w-0 flex-1"><p className="font-semibold">{item.title ?? "FoodBridge update"}</p><p className="mt-1 text-sm leading-6 text-slate-600">{item.message}</p><p className="mt-2 text-xs text-slate-400">{dateLabel(item.created_at)}</p></div>
            {!item.is_read ? <button className="text-xs font-semibold text-forest" onClick={() => void markRead(item.id)} type="button">Mark read</button> : null}
          </Card>
        ))}</div>
      )}
    </>
  );
}

function NgoImpact({
  impact,
  loading,
  error,
  onRetry,
}: {
  impact: ImpactTotals | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  return (
    <>
      <DashboardHeading eyebrow="Measured impact" title="Community impact" description="Totals from recorded donation impact—not estimates generated by the dashboard." />
      {loading || error ? <DashboardState loading={loading} error={error} onRetry={onRetry} /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Food saved" value={`${Number(impact?.food_saved_kg ?? 0).toLocaleString()} kg`} />
          <StatCard label="Meals distributed" value={Number(impact?.meals_provided ?? 0).toLocaleString()} tone="butter" />
          <StatCard label="CO₂ avoided" value={`${Number(impact?.co2_saved_kg ?? 0).toLocaleString()} kg`} tone="powder" />
          <StatCard label="Donations with impact" value={impact?.donations ?? 0} tone="blush" />
        </div>
      )}
    </>
  );
}

function NgoProfile({
  profile,
  email,
  fullName,
  phone,
  onSaved,
}: {
  profile: NgoProfileDetails | null;
  email: string;
  fullName: string;
  phone: string;
  onSaved: (profile: NgoProfileDetails | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [categories, setCategories] = useState<string[]>(profile?.preferred_categories ?? []);
  const [capacity, setCapacity] = useState(profile?.max_daily_quantity?.toString() ?? "");
  const [capacityUnit, setCapacityUnit] = useState(profile?.capacity_unit ?? "");
  const [name, setName] = useState(fullName);
  const [contact, setContact] = useState(phone);
  const [organization, setOrganization] = useState(profile?.organization_name ?? "");
  const [city, setCity] = useState(profile?.city ?? "");
  const [address, setAddress] = useState(profile?.address ?? "");
  const navigate = useNavigate();
  useEffect(() => {
    setCategories(profile?.preferred_categories ?? []);
    setCapacity(profile?.max_daily_quantity?.toString() ?? "");
    setCapacityUnit(profile?.capacity_unit ?? "");
    setOrganization(profile?.organization_name ?? "");
    setCity(profile?.city ?? "");
    setAddress(profile?.address ?? "");
  }, [profile]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved("");
    try {
      await dashboardRequest("/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: name,
          phone: contact,
          organization_name: organization,
          address,
          city,
          preferred_categories: categories,
          max_daily_quantity: capacity ? Number(capacity) : null,
          capacity_unit: capacity ? capacityUnit || null : null,
        }),
      });
      onSaved({
        ...(profile ?? {
          registration_number: null,
          is_verified: false,
        }),
        organization_name: organization,
        address,
        city,
        preferred_categories: categories,
        max_daily_quantity: capacity ? Number(capacity) : null,
        capacity_unit: capacity ? capacityUnit || null : null,
      });
      setSaved("Your profile and matching preferences were saved.");
    } catch (saveError) {
      setError(dashboardErrorMessage(saveError, "Could not save your profile."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <DashboardHeading eyebrow="Organization settings" title="Profile & matching preferences" description="These preferences help rank relevant food. Capacity is your preferred daily quantity in the same units donors use." />
      {!profile?.is_verified ? <div className="mb-5 rounded-xl border border-[#e6d9aa] bg-[#fbf3d9] p-4 text-sm text-[#68551e]">Your NGO must be verified by an administrator before accepting donations.</div> : null}
      <Card className="max-w-3xl p-5 sm:p-7">
        <form className="space-y-5" onSubmit={(event) => void save(event)}>
          {saved ? <p className="rounded-xl bg-[#eaf0e7] p-3 text-sm text-forest" role="status">{saved}</p> : null}
          {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <InputField label="Contact name" name="ngo-contact-name" onChange={(event) => setName(event.currentTarget.value)} required value={name} />
            <InputField label="Email" name="ngo-email" readOnly value={email} />
            <InputField label="Phone" name="ngo-phone" onChange={(event) => setContact(event.currentTarget.value)} required value={contact} />
            <InputField label="Organization name" name="ngo-name" onChange={(event) => setOrganization(event.currentTarget.value)} required value={organization} />
            <InputField label="City" name="ngo-city" onChange={(event) => setCity(event.currentTarget.value)} required value={city} />
            <InputField label="Daily capacity" hint="Optional; donor quantity units" name="ngo-capacity" min="0.01" onChange={(event) => setCapacity(event.currentTarget.value)} type="number" value={capacity} />
            <div>
              <label className="mb-2 block text-sm font-semibold" htmlFor="ngo-capacity-unit">Capacity unit</label>
              <select className="ds-field" id="ngo-capacity-unit" onChange={(event) => setCapacityUnit(event.currentTarget.value)} value={capacityUnit}>
                <option value="">Select unit</option>
                {["servings", "kg", "items", "boxes", "litres"].map((unit) => <option key={unit} value={unit}>{pretty(unit)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="ngo-address">Organization address</label>
            <textarea className="ds-field min-h-20" id="ngo-address" onChange={(event) => setAddress(event.currentTarget.value)} required value={address} />
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Preferred food categories</legend>
            <p className="mb-3 text-xs text-slate-500">Leave all unchecked to receive a neutral category score for every food type.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {foodCategories.map((item) => (
                <label className="flex items-center gap-2 rounded-xl border border-charcoal/8 px-3 py-2 text-sm" key={item.value}>
                  <input checked={categories.includes(item.value)} onChange={(event) => setCategories((current) => event.currentTarget.checked ? [...current, item.value] : current.filter((value) => value !== item.value))} type="checkbox" />
                  {item.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-3">
            <Button disabled={busy} type="submit">{busy ? "Saving…" : "Save preferences"}</Button>
            <Button onClick={() => navigate("/dashboard/ngo?tab=available")} variant="secondary">View matches</Button>
          </div>
        </form>
      </Card>
    </>
  );
}
