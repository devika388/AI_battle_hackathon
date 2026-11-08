import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge, Button, Card, InputField, SelectField } from "../../components/ui";
import { FoodPassport } from "../../components/FoodPassport";
import { useAuth } from "../../auth/AuthContext";
import {
  dashboardErrorMessage,
  dashboardRequest,
} from "../../services/dashboardApi";
import { getSupabaseClient } from "../../services/supabaseClient";
import type {
  Donation,
  DonationDetails,
  ImpactTotals,
  NotificationItem,
} from "../../types/food";
import {
  DashboardHeading,
  DashboardShell,
  DashboardState,
  StatCard,
  useDashboardTab,
} from "./DashboardShell";

const categories = [
  { value: "cooked_meals", label: "Cooked Meals" },
  { value: "fruits", label: "Fruits" },
  { value: "vegetables", label: "Vegetables" },
  { value: "bakery", label: "Bakery" },
  { value: "dairy", label: "Dairy" },
  { value: "packaged_food", label: "Packaged Food" },
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

export function DonorDashboard() {
  const { donationId } = useParams();
  const { tab, selectTab } = useDashboardTab("donor");
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [impact, setImpact] = useState<ImpactTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [donationResult, notificationResult, impactResult] = await Promise.all([
        dashboardRequest<{ donations: Donation[] }>("/donations/mine?limit=100"),
        dashboardRequest<{ notifications: NotificationItem[] }>("/notifications?limit=50"),
        dashboardRequest<{ impact: ImpactTotals }>("/impact"),
      ]);
      setDonations(donationResult.donations);
      setNotifications(notificationResult.notifications);
      setImpact(impactResult.impact);
    } catch (error) {
      setLoadError(dashboardErrorMessage(error, "Unable to load donor data."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const totals = useMemo(() => ({
    all: donations.length,
    available: donations.filter((item) => item.status === "available").length,
    accepted: donations.filter((item) =>
      ["matched", "accepted", "assigned", "picked_up", "delivered", "completed"].includes(item.status),
    ).length,
    completed: donations.filter((item) => item.status === "completed").length,
  }), [donations]);

  if (donationId) {
    return (
      <DashboardShell
        role="donor"
        activeTab="donations"
        onTabChange={(next) => navigate(
          next === "overview" ? "/dashboard/donor" : `/dashboard/donor?tab=${next}`,
        )}
      >
        <DonorDonationDetails
          donationId={donationId}
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role="donor" activeTab={tab} onTabChange={selectTab}>
      {tab === "overview" ? (
        <Overview
          donations={donations}
          totals={totals}
          impact={impact}
          loading={loading}
          error={loadError}
          onRetry={loadDashboard}
          onCreate={() => selectTab("create")}
          onOpenDonation={(id) => navigate(`/dashboard/donor/donations/${id}`)}
        />
      ) : null}
      {tab === "create" ? (
        <CreateDonation
          onCreated={(donation) => {
            setDonations((current) => [donation, ...current]);
            selectTab("donations");
          }}
        />
      ) : null}
      {tab === "donations" || tab === "history" ? (
        <DonationsList
          donations={donations}
          loading={loading}
          error={loadError}
          historical={tab === "history"}
          onRetry={loadDashboard}
          onChanged={loadDashboard}
          onOpen={(id) => navigate(`/dashboard/donor/donations/${id}`)}
        />
      ) : null}
      {tab === "notifications" ? (
        <Notifications
          items={notifications}
          loading={loading}
          error={loadError}
          onRetry={loadDashboard}
          onRead={(id) => setNotifications((current) =>
            current.map((item) => item.id === id ? { ...item, is_read: true } : item),
          )}
        />
      ) : null}
      {tab === "impact" ? <ImpactPage impact={impact} loading={loading} error={loadError} onRetry={loadDashboard} /> : null}
      {tab === "profile" ? (
        <ProfilePage
          fallbackName={profile?.full_name ?? ""}
          fallbackPhone={profile?.phone ?? ""}
          email={profile?.email ?? ""}
        />
      ) : null}
    </DashboardShell>
  );
}

function Overview({
  donations,
  totals,
  impact,
  loading,
  error,
  onRetry,
  onCreate,
  onOpenDonation,
}: {
  donations: Donation[];
  totals: { all: number; available: number; accepted: number; completed: number };
  impact: ImpactTotals | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onCreate: () => void;
  onOpenDonation: (id: string) => void;
}) {
  return (
    <>
      <DashboardHeading
        eyebrow="Your giving, in motion"
        title="Good food goes further."
        description="Track each contribution and see the difference your surplus makes in your community."
        action={<Button onClick={onCreate}>＋ Create a donation</Button>}
      />
      {error ? <DashboardState loading={false} error={error} onRetry={onRetry} /> : null}
      {loading ? <DashboardState loading /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total donations" value={totals.all} note="All-time contributions" />
            <StatCard label="Available" value={totals.available} note="Ready for an NGO" tone="butter" />
            <StatCard label="Accepted" value={totals.accepted} note="Matched and in delivery" tone="powder" />
            <StatCard label="Completed" value={totals.completed} note="Receipt confirmed" tone="blush" />
            <StatCard label="Food saved" value={`${Number(impact?.food_saved_kg ?? 0).toLocaleString()} kg`} note="Recorded platform impact" tone="sage" />
            <StatCard label="Meals provided" value={Number(impact?.meals_provided ?? 0).toLocaleString()} note="Recorded platform impact" tone="butter" />
          </div>
          <Card className="mt-6 overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-charcoal/8 px-5 py-4 sm:px-6">
              <div>
                <h2 className="font-semibold text-charcoal">Recent donations</h2>
                <p className="mt-1 text-xs text-slate-500">Live updates from your donation history</p>
              </div>
              <button
                className="text-sm font-semibold text-forest hover:underline"
                onClick={() => onCreate()}
                type="button"
              >
                New donation
              </button>
            </div>
            {!donations.length ? <DashboardState empty /> : (
              <div className="divide-y divide-charcoal/8">
                {donations.slice(0, 5).map((donation) => (
                  <DonationRow
                    donation={donation}
                    key={donation.id}
                    onOpen={() => onOpenDonation(donation.id)}
                  />
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}

function DonationRow({
  donation,
  onOpen,
}: {
  donation: Donation;
  onOpen: () => void;
}) {
  return (
    <button
      className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-cream/70 sm:px-6"
      onClick={onOpen}
      type="button"
    >
      {donation.image_url ? (
        <img alt="" className="h-12 w-12 rounded-xl object-cover" src={donation.image_url} />
      ) : (
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#eaf0e7] text-lg text-forest">✳</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-charcoal">{donation.food_name}</span>
        <span className="mt-1 block text-xs text-slate-500">{donation.quantity} {donation.quantity_unit} · {dateLabel(donation.created_at)}</span>
      </span>
      <Badge tone={statusTone[donation.status] ?? "neutral"}>{pretty(donation.status)}</Badge>
      <span aria-hidden="true" className="hidden text-slate-400 sm:inline">›</span>
    </button>
  );
}

function CreateDonation({ onCreated }: { onCreated: (donation: Donation) => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [image, setImage] = useState<File | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!user) {
      setError("Sign in again before creating a donation.");
      return;
    }
    const form = event.currentTarget;
    const values = new FormData(form);
    const prep = new Date(String(values.get("preparation_time")));
    const expiry = new Date(String(values.get("expiry_time")));
    if (!Number.isFinite(prep.getTime()) || !Number.isFinite(expiry.getTime())) {
      setError("Enter a valid preparation and expiry time.");
      return;
    }
    if (expiry <= new Date() || expiry <= prep) {
      setError("Expiry must be in the future and after the preparation time.");
      return;
    }
    if (
      image &&
      (!["image/jpeg", "image/png", "image/webp"].includes(image.type) ||
        image.size > 10 * 1024 * 1024)
    ) {
      setError("Choose an image under 10 MB.");
      return;
    }

    setBusy(true);
    let uploadedPath: string | null = null;
    try {
      let imageUrl: string | null = null;
      if (image) {
        const extension = image.name.split(".").pop()?.toLowerCase() || "jpg";
        uploadedPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await getSupabaseClient()
          .storage.from("food-images")
          .upload(uploadedPath, image, { contentType: image.type, upsert: false });
        if (uploadError) throw new Error(`Food image upload failed: ${uploadError.message}`);
        imageUrl = getSupabaseClient()
          .storage.from("food-images")
          .getPublicUrl(uploadedPath).data.publicUrl;
      }

      const result = await dashboardRequest<{ donation: Donation }>("/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food_name: values.get("food_name"),
          food_category: values.get("food_category"),
          description: values.get("description"),
          quantity: Number(values.get("quantity")),
          quantity_unit: values.get("quantity_unit"),
          preparation_time: prep.toISOString(),
          expiry_time: expiry.toISOString(),
          pickup_address: values.get("pickup_address"),
          city: values.get("city"),
          pincode: values.get("pincode"),
          image_url: imageUrl,
        }),
      });
      form.reset();
      setImage(null);
      onCreated(result.donation);
    } catch (submitError) {
      if (uploadedPath) {
        const { error: cleanupError } = await getSupabaseClient()
          .storage.from("food-images").remove([uploadedPath]);
        if (cleanupError) {
          console.error("Could not remove unused donation image:", cleanupError);
        }
      }
      setError(dashboardErrorMessage(submitError, "We couldn't create your donation."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DashboardHeading
        eyebrow="Share surplus food"
        title="Create a donation"
        description="A little detail helps nearby organizations decide quickly and coordinate a safe pickup."
      />
      <form className="space-y-5" onSubmit={(event) => void submit(event)}>
        {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p> : null}
        <Card className="p-5 sm:p-7">
          <h2 className="text-base font-semibold">Food details</h2>
          <p className="mt-1 text-sm text-slate-500">Tell NGOs what is available and how much.</p>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <InputField label="Food name" name="food_name" placeholder="e.g. Vegetable rice bowls" required maxLength={160} />
            <SelectField label="Food category" name="food_category" options={categories} required />
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-charcoal" htmlFor="description">Description</label>
              <textarea className="ds-field min-h-24 resize-y" id="description" name="description" maxLength={2000} placeholder="Ingredients, storage instructions, allergens, or other helpful details" required />
            </div>
            <InputField label="Quantity" name="quantity" type="number" min="0.01" step="0.01" placeholder="25" required />
            <SelectField
              label="Quantity unit"
              name="quantity_unit"
              options={[
                { value: "servings", label: "Servings" },
                { value: "kg", label: "Kilograms (kg)" },
                { value: "items", label: "Items" },
                { value: "boxes", label: "Boxes" },
                { value: "litres", label: "Litres" },
              ]}
              required
            />
            <InputField label="Prepared at" name="preparation_time" type="datetime-local" required />
            <InputField label="Use by / expiry" name="expiry_time" type="datetime-local" required />
          </div>
        </Card>
        <Card className="p-5 sm:p-7">
          <h2 className="text-base font-semibold">Pickup details</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <InputField label="Pickup address" name="pickup_address" placeholder="Street address and pickup instructions" required maxLength={1000} />
            </div>
            <InputField label="City" name="city" placeholder="City" required maxLength={120} />
            <InputField label="Pincode" name="pincode" placeholder="Postal code" required minLength={4} maxLength={12} />
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-charcoal" htmlFor="food-image">Food image <span className="font-normal text-slate-500">(optional)</span></label>
              <input
                accept="image/jpeg,image/png,image/webp"
                className="ds-field h-auto cursor-pointer file:mr-4 file:rounded-lg file:border-0 file:bg-[#eaf0e7] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-forest"
                id="food-image"
                onChange={(event) => setImage(event.currentTarget.files?.[0] ?? null)}
                type="file"
              />
              <p className="mt-2 text-xs text-slate-500">JPEG, PNG, or WebP up to 10 MB. Stored in the FoodBridge food-images bucket.</p>
            </div>
          </div>
        </Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-5 text-slate-500">Your authenticated donor account will be attached automatically.</p>
          <Button disabled={busy} type="submit">{busy ? "Creating donation…" : "Publish donation"}</Button>
        </div>
      </form>
    </>
  );
}

function DonationsList({
  donations,
  loading,
  error,
  historical,
  onRetry,
  onChanged,
  onOpen,
}: {
  donations: Donation[];
  loading: boolean;
  error: string;
  historical: boolean;
  onRetry: () => void;
  onChanged: () => void;
  onOpen: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [busyId, setBusyId] = useState("");
  const [actionError, setActionError] = useState("");
  const filtered = donations.filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesText = !query || [item.food_name, item.id, item.city, item.food_category].some((value) => value?.toLowerCase().includes(query));
    const matchesStatus = status === "all" || item.status === status;
    return matchesText && matchesStatus && (historical ? ["completed", "cancelled", "expired"].includes(item.status) : !["completed", "cancelled", "expired"].includes(item.status));
  });

  const cancel = async (id: string) => {
    setBusyId(id);
    setActionError("");
    try {
      await dashboardRequest(`/donations/${id}`, { method: "DELETE" });
      await onChanged();
    } catch (error) {
      setActionError(dashboardErrorMessage(error, "Could not cancel this donation."));
    } finally {
      setBusyId("");
    }
  };

  return (
    <>
      <DashboardHeading
        eyebrow={historical ? "Completed and closed" : "Track each handoff"}
        title={historical ? "Donation history" : "My donations"}
        description={historical ? "A record of completed, cancelled, and expired donations." : "Search donations, review their status, and follow each handoff."}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <input aria-label="Search donations" className="ds-field" onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Search food, city, category, or ID" value={search} />
        <select aria-label="Filter by status" className="ds-field" onChange={(event) => setStatus(event.currentTarget.value)} value={status}>
          <option value="all">All statuses</option>
          {["available", "matched", "assigned", "picked_up", "delivered", "completed", "cancelled", "expired"].map((item) => <option key={item} value={item}>{pretty(item)}</option>)}
        </select>
      </div>
      {actionError ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{actionError}</p> : null}
      {loading || error ? <DashboardState loading={loading} error={error} onRetry={onRetry} /> : !filtered.length ? <DashboardState empty /> : (
        <div className="space-y-3">
          {filtered.map((donation) => (
            <Card className="overflow-hidden p-4 sm:p-5" key={donation.id}>
              <div className="flex flex-wrap items-center gap-4">
                {donation.image_url ? <img alt="" className="h-16 w-16 rounded-xl object-cover" src={donation.image_url} /> : <div className="grid h-16 w-16 place-items-center rounded-xl bg-[#eaf0e7] text-xl text-forest">✳</div>}
                <div className="min-w-[12rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-charcoal">{donation.food_name}</h2>
                    <Badge tone={statusTone[donation.status] ?? "neutral"}>{pretty(donation.status)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{donation.quantity} {donation.quantity_unit} · {donation.city ?? donation.pickup_address}</p>
                  <p className="mt-1 text-xs text-slate-500">Created {dateLabel(donation.created_at)}</p>
                  <p className="mt-1 truncate font-mono text-[0.68rem] text-slate-400">ID {donation.id}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => onOpen(donation.id)} size="sm" variant="secondary">Details</Button>
                  {donation.status === "available" && !historical ? (
                    <Button disabled={busyId === donation.id} onClick={() => void cancel(donation.id)} size="sm" variant="destructive">
                      {busyId === donation.id ? "Cancelling…" : "Cancel"}
                    </Button>
                  ) : null}
                </div>
              </div>
              {donation.assignment ? (
                <div className="mt-4 grid gap-2 border-t border-charcoal/8 pt-3 text-xs text-slate-500 sm:grid-cols-2">
                  <p>Matched NGO: <span className="font-semibold text-charcoal">{donation.assignment.ngo_profiles?.organization_name ?? "NGO assigned"}</span></p>
                  <p>Delivery partner: <span className="font-semibold text-charcoal">{donation.assignment.partner_profiles?.vehicle_type ?? (donation.assignment.partner_id ? "Assigned" : "Awaiting assignment")}</span></p>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function DonorDonationDetails({
  donationId,
}: {
  donationId: string;
}) {
  const navigate = useNavigate();
  const [details, setDetails] = useState<DonationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await dashboardRequest<{ donation: DonationDetails }>(`/donations/${donationId}`);
      setDetails(result.donation);
    } catch (loadError) {
      setError(dashboardErrorMessage(loadError, "Could not load donation details."));
    } finally {
      setLoading(false);
    }
  }, [donationId]);
  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <DashboardHeading
        eyebrow="Food passport"
        title={details?.food_name ?? "Donation details"}
        description="A private, live record of this donation and its journey."
        action={<Button onClick={() => navigate("/dashboard/donor?tab=donations")} variant="secondary">← My donations</Button>}
      />
      <DashboardState loading={loading} error={error} onRetry={() => void load()} />
      {details ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(17rem,0.7fr)]">
          <div className="space-y-5">
            <Card className="overflow-hidden">
              {details.image_url ? <img alt={details.food_name} className="h-64 w-full object-cover" src={details.image_url} /> : null}
              <div className="p-5 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Badge tone={statusTone[details.status] ?? "neutral"}>{pretty(details.status)}</Badge>
                  <span className="font-mono text-xs text-slate-400">{details.id}</span>
                </div>
                <h2 className="mt-4 text-xl font-semibold">{details.food_name}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{details.description || "No additional description."}</p>
                <div className="mt-5 grid gap-4 border-t border-charcoal/8 pt-4 sm:grid-cols-2">
                  <Detail label="Quantity" value={`${details.quantity} ${details.quantity_unit}`} />
                  <Detail label="Category" value={pretty(details.food_category)} />
                  <Detail label="Prepared at" value={dateLabel(details.preparation_time)} />
                  <Detail label="Expiry" value={dateLabel(details.expiry_time)} />
                  <Detail label="Pickup address" value={`${details.pickup_address}, ${details.city ?? ""} ${details.pincode ?? ""}`} />
                </div>
              </div>
            </Card>
            <FoodPassport
              donationId={details.id}
              donationStatus={details.status}
              events={details.status_events ?? []}
            />
          </div>
          <div className="space-y-5">
            <Card className="p-5">
              <h2 className="font-semibold">Matching & delivery</h2>
              <div className="mt-4 space-y-4 text-sm">
                <Detail label="Matched NGO" value={details.assignment?.ngo_profiles?.organization_name ?? "Waiting for an NGO"} />
                <Detail label="Delivery partner" value={details.assignment?.partner_profiles?.vehicle_type ?? (details.assignment?.partner_id ? "Partner assigned" : "Not assigned yet")} />
                <Detail label="Delivery status" value={details.assignment?.status ? pretty(details.assignment.status) : "Not started"} />
              </div>
            </Card>
            <Card className="p-5">
              <h2 className="font-semibold">Delivery confirmation</h2>
              {details.delivery_proofs?.length ? (
                <div className="mt-3 space-y-2">
                  {details.delivery_proofs.map((proof) => (
                    <div className="rounded-xl bg-[#f7f6f0] p-3" key={proof.id}>
                      <p className="text-sm font-semibold">Proof uploaded</p>
                      <p className="mt-1 text-xs text-slate-500">{dateLabel(proof.delivered_at)}{proof.notes ? ` · ${proof.notes}` : ""}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-2 text-sm leading-6 text-slate-500">Delivery confirmation will appear here when the partner completes the handoff.</p>}
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-charcoal">{value}</p>
    </div>
  );
}

function Notifications({
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
    } catch (readError) {
      setActionError(dashboardErrorMessage(readError, "Could not update notification."));
    }
  };
  return (
    <>
      <DashboardHeading eyebrow="Stay in the loop" title="Notifications" description="Updates about your donations, matches, and delivery handoffs." />
      {actionError ? <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{actionError}</p> : null}
      <DashboardState loading={loading} error={error} onRetry={onRetry} />
      {!loading && !error && !items.length ? <DashboardState empty /> : null}
      {!loading && !error ? <div className="space-y-3">{items.map((item) => (
        <Card className={`flex items-start gap-4 p-4 sm:p-5 ${item.is_read ? "" : "border-forest/20 bg-[#fcfdfb]"}`} key={item.id}>
          <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.is_read ? "bg-slate-200" : "bg-forest"}`} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-charcoal">{item.title ?? "FoodBridge update"}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{item.message}</p>
            <p className="mt-2 text-xs text-slate-400">{dateLabel(item.created_at)}</p>
          </div>
          {!item.is_read ? <button className="shrink-0 text-xs font-semibold text-forest hover:underline" onClick={() => void markRead(item.id)} type="button">Mark read</button> : null}
        </Card>
      ))}</div> : null}
    </>
  );
}

function ImpactPage({
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
      <DashboardHeading eyebrow="Measured together" title="Your impact" description="Impact totals are calculated from completed platform impact records." />
      {loading || error ? <DashboardState loading={loading} error={error} onRetry={onRetry} /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Food saved" value={`${Number(impact?.food_saved_kg ?? 0).toLocaleString()} kg`} />
          <StatCard label="Meals provided" value={Number(impact?.meals_provided ?? 0).toLocaleString()} tone="butter" />
          <StatCard label="CO₂ avoided" value={`${Number(impact?.co2_saved_kg ?? 0).toLocaleString()} kg`} tone="powder" />
          <StatCard label="Donations with impact" value={impact?.donations ?? 0} tone="blush" />
        </div>
      )}
    </>
  );
}

function ProfilePage({
  fallbackName,
  fallbackPhone,
  email,
}: {
  fallbackName: string;
  fallbackPhone: string;
  email: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState(fallbackName);
  const [phone, setPhone] = useState(fallbackPhone);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await dashboardRequest("/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: name, phone }),
      });
      setMessage("Your profile details were updated.");
    } catch (saveError) {
      setError(dashboardErrorMessage(saveError, "Could not update your profile."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <DashboardHeading eyebrow="Your account" title="Profile" description="Keep your contact details current so organizations can coordinate with you." />
      <Card className="max-w-2xl p-5 sm:p-7">
        <form className="space-y-5" onSubmit={(event) => void save(event)}>
          {message ? <p className="rounded-xl bg-[#eaf0e7] p-3 text-sm text-forest" role="status">{message}</p> : null}
          {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}
          <InputField label="Full name" name="profile-full-name" onChange={(event) => setName(event.currentTarget.value)} required value={name} />
          <InputField label="Email" name="profile-email" readOnly value={email} />
          <InputField label="Phone" name="profile-phone" onChange={(event) => setPhone(event.currentTarget.value)} required value={phone} />
          <Button disabled={busy} type="submit">{busy ? "Saving…" : "Save profile"}</Button>
        </form>
      </Card>
    </>
  );
}
