import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Badge, Button, Card, InputField } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { dashboardErrorMessage, dashboardRequest } from "../../services/dashboardApi";
import type { NotificationItem } from "../../types/food";
import {
  DashboardHeading,
  DashboardShell,
  DashboardState,
  StatCard,
  useDashboardTab,
  type DashboardTab,
} from "./DashboardShell";

interface Assignment {
  id: string;
  donation_id: string;
  partner_id: string | null;
  ngo_id: string | null;
  status: string;
  delivery_stage: string;
  assigned_at: string;
  donations: {
    id: string;
    food_name: string;
    quantity: number;
    quantity_unit: string;
    pickup_address: string;
    city: string | null;
    expiry_time: string;
  } | null;
  ngo_profiles?: {
    organization_name: string | null;
    address: string | null;
    city: string | null;
  } | null;
  delivery_proofs?: {
    id: string;
    notes: string | null;
    receiver_name: string | null;
    delivered_at: string;
  }[];
}

async function loadPartnerAssignments(path: string) {
  const assignments: Assignment[] = [];
  for (let offset = 0; ; offset += 100) {
    const result = await dashboardRequest<{ assignments: Assignment[] }>(
      `${path}?limit=100&offset=${offset}`,
    );
    assignments.push(...result.assignments);
    if (result.assignments.length < 100) return assignments;
  }
}

interface PartnerProfile {
  vehicle_type: string | null;
  vehicle_number: string | null;
  availability: boolean;
}

const stages = [
  ["pickup_pending", "Assignment accepted"],
  ["pickup_started", "Pickup started"],
  ["picked_up", "Pickup confirmed"],
  ["in_transit", "In transit"],
  ["arrived", "Reached NGO"],
  ["proof_submitted", "Delivery proof submitted"],
  ["awaiting_receipt", "Awaiting NGO receipt"],
  ["completed", "Completed"],
] as const;

function dateLabel(value?: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function nice(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function DeliveryPartnerDashboard() {
  const { profile } = useAuth();
  const { tab, selectTab } = useDashboardTab("delivery_partner");
  const [available, setAvailable] = useState<Assignment[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [partnerProfile, setPartnerProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [availableAssignments, myAssignments, notificationsResult, profileResult] =
        await Promise.all([
          loadPartnerAssignments("/partners/assignments/available"),
          loadPartnerAssignments("/partners/assignments"),
          dashboardRequest<{ notifications: NotificationItem[] }>("/notifications?limit=50"),
          dashboardRequest<{ profile: { partner?: PartnerProfile } }>("/profile"),
        ]);
      setAvailable(availableAssignments);
      setAssignments(myAssignments);
      setNotifications(notificationsResult.notifications);
      setPartnerProfile(profileResult.profile.partner ?? null);
    } catch (loadError) {
      setError(dashboardErrorMessage(loadError, "Could not load delivery partner data."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => ({
    assigned: assignments.filter((item) => item.status === "assigned").length,
    pending: assignments.filter((item) => ["pickup_pending", "pickup_started"].includes(item.delivery_stage)).length,
    transit: assignments.filter((item) => ["picked_up", "in_transit", "arrived", "proof_submitted"].includes(item.delivery_stage)).length,
    completed: assignments.filter((item) => item.status === "completed").length,
  }), [assignments]);

  return (
    <DashboardShell role="delivery_partner" activeTab={tab} onTabChange={selectTab}>
      {tab === "overview" ? (
        <Overview
          stats={stats}
          assignments={assignments}
          loading={loading}
          error={error}
          onRetry={load}
          onOpen={(next) => selectTab(next)}
        />
      ) : null}
      {tab === "available" ? (
        <AssignmentsList
          title="Available assignments"
          records={available}
          loading={loading}
          error={error}
          onRetry={load}
          onChanged={load}
          available
        />
      ) : null}
      {tab === "assignments" || tab === "history" ? (
        <AssignmentsList
          title={tab === "history" ? "Completed deliveries" : "My deliveries"}
          records={tab === "history" ? assignments.filter((item) => item.status === "completed") : assignments.filter((item) => item.status !== "completed")}
          loading={loading}
          error={error}
          onRetry={load}
          onChanged={load}
        />
      ) : null}
      {tab === "notifications" ? (
        <Notifications items={notifications} loading={loading} error={error} onRetry={load} onChanged={load} />
      ) : null}
      {tab === "profile" ? (
        <PartnerSettings
          initialProfile={partnerProfile}
          fullName={profile?.full_name ?? ""}
          phone={profile?.phone ?? ""}
          email={profile?.email ?? ""}
          onSaved={setPartnerProfile}
        />
      ) : null}
    </DashboardShell>
  );
}

function Overview({
  stats,
  assignments,
  loading,
  error,
  onRetry,
  onOpen,
}: {
  stats: { assigned: number; pending: number; transit: number; completed: number };
  assignments: Assignment[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onOpen: (tab: DashboardTab) => void;
}) {
  return (
    <>
      <DashboardHeading eyebrow="Food rescue logistics" title="Every pickup matters." description="Accept a route, keep its delivery checkpoints current, and submit private proof when the food reaches the NGO." action={<Button onClick={() => onOpen("available")}>Find assignments</Button>} />
      {loading || error ? <DashboardState loading={loading} error={error} onRetry={onRetry} /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Assigned deliveries" value={stats.assigned} note="Accepted and awaiting pickup" />
            <StatCard label="Pending pickups" value={stats.pending} note="Pickup checkpoint in progress" tone="butter" />
            <StatCard label="In-transit deliveries" value={stats.transit} note="On the way to an NGO" tone="powder" />
            <StatCard label="Completed deliveries" value={stats.completed} note="Receipt confirmed by NGO" tone="sage" />
          </div>
          <section className="mt-7">
            <h2 className="mb-3 text-lg font-semibold">Current deliveries</h2>
            {assignments.filter((item) => item.status !== "completed").length ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {assignments.filter((item) => item.status !== "completed").slice(0, 4).map((item) => <AssignmentCard key={item.id} assignment={item} onChanged={onRetry} />)}
              </div>
            ) : <DashboardState empty />}
          </section>
        </>
      )}
    </>
  );
}

function AssignmentsList({
  title,
  records,
  loading,
  error,
  onRetry,
  onChanged,
  available = false,
}: {
  title: string;
  records: Assignment[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onChanged: () => void;
  available?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const filtered = records.filter((assignment) => {
    const donation = assignment.donations;
    const haystack = `${donation?.food_name ?? ""} ${donation?.id ?? ""} ${donation?.city ?? ""} ${donation?.pickup_address ?? ""} ${assignment.ngo_profiles?.organization_name ?? ""}`.toLowerCase();
    return !search || haystack.includes(search.toLowerCase());
  });
  const accept = async (id: string) => {
    setBusy(id);
    setActionError("");
    try {
      await dashboardRequest(`/partners/assignments/${id}/accept`, { method: "POST" });
      await onChanged();
    } catch (failure) {
      setActionError(dashboardErrorMessage(failure, "Could not accept this assignment."));
    } finally {
      setBusy("");
    }
  };
  return (
    <>
      <DashboardHeading eyebrow={available ? "Verified partner routes" : "Your route book"} title={title} description={available ? "Only approved partners with availability enabled can claim an assignment. A claim is atomic, so it can only be accepted once." : "Track each delivery through pickup, transit, proof, and NGO confirmation."} />
      <input aria-label="Search assignments" className="ds-field mb-5" onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Search food, location, NGO, or donation ID" value={search} />
      {actionError ? <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-800" role="alert">{actionError}</p> : null}
      {loading || error ? <DashboardState loading={loading} error={error} onRetry={onRetry} /> : !filtered.length ? <DashboardState empty /> : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((assignment) => (
            <Card className="p-5" key={assignment.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="ds-label text-forest">Donation {assignment.donation_id}</p>
                  <h2 className="mt-2 text-lg font-semibold">{assignment.donations?.food_name ?? "Food donation"}</h2>
                  <p className="mt-1 text-sm text-slate-600">{assignment.donations?.quantity} {assignment.donations?.quantity_unit}</p>
                </div>
                <Badge tone={assignment.status === "completed" ? "forest" : "butter"}>{nice(assignment.status)}</Badge>
              </div>
              <div className="mt-4 grid gap-3 rounded-xl bg-[#f7f6f0] p-4 text-sm sm:grid-cols-2">
                <Info label="Pickup" value={`${assignment.donations?.pickup_address ?? "—"}, ${assignment.donations?.city ?? ""}`} />
                <Info label="Delivery" value={`${assignment.ngo_profiles?.address ?? "NGO location not set"}, ${assignment.ngo_profiles?.city ?? ""}`} />
                <Info label="NGO" value={assignment.ngo_profiles?.organization_name ?? "Assigned NGO"} />
                <Info label="Pickup deadline" value={dateLabel(assignment.donations?.expiry_time)} />
                <Info label="Assignment status" value={nice(assignment.status)} />
                <Info label="Delivery stage" value={nice(assignment.delivery_stage ?? assignment.status)} />
              </div>
              {available ? (
                <Button className="mt-4" disabled={busy === assignment.id} onClick={() => void accept(assignment.id)}>{busy === assignment.id ? "Accepting…" : "Accept assignment"}</Button>
              ) : <AssignmentCard assignment={assignment} onChanged={onChanged} />}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function AssignmentCard({ assignment, onChanged }: { assignment: Assignment; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [receiver, setReceiver] = useState("");
  const [notes, setNotes] = useState("");
  const stageIndex = stages.findIndex(([stage]) => stage === assignment.delivery_stage);
  const advance = async (stage: string) => {
    setBusy(true);
    setError("");
    try {
      await dashboardRequest(`/partners/assignments/${assignment.id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      onChanged();
    } catch (failure) {
      setError(dashboardErrorMessage(failure, "Could not update delivery checkpoint."));
    } finally { setBusy(false); }
  };
  const submitProof = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !receiver.trim()) {
      setError("Select a delivery photograph and enter the receiver's name.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("Use a JPEG, PNG, or WebP photo up to 5 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await dashboardRequest(`/partners/assignments/${assignment.id}/proof`, {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "X-Receiver-Name": encodeURIComponent(receiver.trim()),
          "X-Proof-Notes": encodeURIComponent(notes.slice(0, 500)),
          "X-Delivered-At": new Date().toISOString(),
        },
        body: file,
      });
      onChanged();
    } catch (failure) {
      setError(dashboardErrorMessage(failure, "Could not upload delivery proof."));
    } finally { setBusy(false); }
  };
  const markDelivered = async () => {
    setBusy(true);
    setError("");
    try {
      await dashboardRequest(`/partners/assignments/${assignment.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "delivered", description: `Received by ${receiver.trim()}` }),
      });
      onChanged();
    } catch (failure) {
      setError(dashboardErrorMessage(failure, "Could not mark delivery as delivered."));
    } finally { setBusy(false); }
  };
  if (!assignment.partner_id || assignment.status === "completed") return null;
  return (
    <div className="mt-4 rounded-xl border border-charcoal/8 p-4">
      {error ? <p className="mb-3 text-sm text-red-700" role="alert">{error}</p> : null}
      <ol className="grid gap-2 sm:grid-cols-2">
        {stages.map(([stage, label], index) => (
          <li className={`rounded-lg px-3 py-2 text-xs ${index <= stageIndex ? "bg-[#eaf0e7] font-semibold text-forest" : "bg-[#f7f6f0] text-slate-500"}`} key={stage}>
            {index <= stageIndex ? "✓ " : `${index + 1}. `}{label}
          </li>
        ))}
      </ol>
      {assignment.delivery_stage === "pickup_pending" ? <Button className="mt-4" disabled={busy} onClick={() => void advance("pickup_started")}>Start pickup</Button> : null}
      {assignment.delivery_stage === "pickup_started" ? <Button className="mt-4" disabled={busy} onClick={() => void advance("picked_up")}>Confirm pickup</Button> : null}
      {assignment.delivery_stage === "picked_up" ? <Button className="mt-4" disabled={busy} onClick={() => void advance("in_transit")}>Mark in transit</Button> : null}
      {assignment.delivery_stage === "in_transit" ? <Button className="mt-4" disabled={busy} onClick={() => void advance("arrived")}>Confirm arrival at NGO</Button> : null}
      {assignment.delivery_stage === "arrived" ? (
        <form className="mt-4 space-y-3" onSubmit={(event) => void submitProof(event)}>
          <h3 className="font-semibold">Delivery proof</h3>
          <InputField label="Receiver name" name={`receiver-${assignment.id}`} onChange={(event) => setReceiver(event.currentTarget.value)} required value={receiver} maxLength={120} />
          <label className="block text-sm font-medium" htmlFor={`proof-${assignment.id}`}>Delivery photograph (JPEG, PNG, WebP; up to 5 MB)</label>
          <input accept="image/jpeg,image/png,image/webp" className="ds-field" id={`proof-${assignment.id}`} onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)} required type="file" />
          <label className="block text-sm font-medium" htmlFor={`notes-${assignment.id}`}>Delivery notes</label>
          <textarea className="ds-field min-h-20" id={`notes-${assignment.id}`} maxLength={500} onChange={(event) => setNotes(event.currentTarget.value)} value={notes} />
          <p className="text-xs text-slate-500">The delivery timestamp is recorded when the proof is uploaded. Images remain in the private proof bucket.</p>
          <Button disabled={busy} type="submit">{busy ? "Uploading…" : "Upload proof"}</Button>
        </form>
      ) : null}
      {assignment.delivery_stage === "proof_submitted" ? <Button className="mt-4" disabled={busy} onClick={() => void markDelivered()}>{busy ? "Saving…" : "Confirm delivery to NGO"}</Button> : null}
      {assignment.delivery_stage === "awaiting_receipt" ? <p className="mt-4 text-sm text-slate-600">Delivery is with the NGO. Completion is recorded after the NGO confirms receipt.</p> : null}
      {(assignment.delivery_proofs ?? []).map((proof) => (
        <p className="mt-3 text-xs text-slate-500" key={proof.id}>Proof uploaded {dateLabel(proof.delivered_at)} · Receiver: {proof.receiver_name ?? "Not recorded"}{proof.notes ? ` · ${proof.notes}` : ""}</p>
      ))}
    </div>
  );
}

function Notifications({
  items,
  loading,
  error,
  onRetry,
  onChanged,
}: {
  items: NotificationItem[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onChanged: () => void;
}) {
  const [actionError, setActionError] = useState("");
  const markRead = async (id: string) => {
    try {
      await dashboardRequest(`/notifications/${id}/read`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_read: true }) });
      onChanged();
    } catch (failure) { setActionError(dashboardErrorMessage(failure, "Could not update notification.")); }
  };
  return (
    <>
      <DashboardHeading eyebrow="Route updates" title="Notifications" />
      {actionError ? <p className="mb-4 text-sm text-red-700" role="alert">{actionError}</p> : null}
      {loading || error ? <DashboardState loading={loading} error={error} onRetry={onRetry} /> : !items.length ? <DashboardState empty /> : (
        <div className="space-y-3">{items.map((item) => <Card className="flex items-start gap-4 p-5" key={item.id}>
          <div className="min-w-0 flex-1"><h2 className="font-semibold">{item.title ?? "FoodBridge update"}</h2><p className="mt-1 text-sm text-slate-600">{item.message}</p><p className="mt-2 text-xs text-slate-400">{dateLabel(item.created_at)}</p></div>
          {!item.is_read ? <button className="text-sm font-semibold text-forest" onClick={() => void markRead(item.id)} type="button">Mark read</button> : null}
        </Card>)}</div>
      )}
    </>
  );
}

function PartnerSettings({
  initialProfile,
  fullName,
  phone,
  email,
  onSaved,
}: {
  initialProfile: PartnerProfile | null;
  fullName: string;
  phone: string;
  email: string;
  onSaved: (profile: PartnerProfile) => void;
}) {
  const [name, setName] = useState(fullName);
  const [contact, setContact] = useState(phone);
  const [vehicleType, setVehicleType] = useState(initialProfile?.vehicle_type ?? "");
  const [vehicleNumber, setVehicleNumber] = useState(initialProfile?.vehicle_number ?? "");
  const [availability, setAvailability] = useState(initialProfile?.availability ?? false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setName(fullName);
    setContact(phone);
    setVehicleType(initialProfile?.vehicle_type ?? "");
    setVehicleNumber(initialProfile?.vehicle_number ?? "");
    setAvailability(initialProfile?.availability ?? false);
  }, [fullName, initialProfile, phone]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await dashboardRequest("/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: name, phone: contact, vehicle_type: vehicleType, vehicle_number: vehicleNumber, availability }),
      });
      onSaved({ vehicle_type: vehicleType, vehicle_number: vehicleNumber, availability });
      setMessage("Profile saved.");
    } catch (failure) { setError(dashboardErrorMessage(failure, "Could not save your profile.")); }
    finally { setBusy(false); }
  };
  return (
    <>
      <DashboardHeading eyebrow="Partner settings" title="Profile & availability" description="Only approved partners can enable availability and accept routes." />
      <Card className="max-w-3xl p-5 sm:p-7">
        <form className="space-y-4" onSubmit={(event) => void save(event)}>
          {message ? <p className="rounded-lg bg-[#eaf0e7] p-3 text-sm text-forest" role="status">{message}</p> : null}
          {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField label="Name" name="partner-name" onChange={(event) => setName(event.currentTarget.value)} required value={name} />
            <InputField label="Email" name="partner-email" readOnly value={email} />
            <InputField label="Phone" name="partner-phone" onChange={(event) => setContact(event.currentTarget.value)} required value={contact} />
            <InputField label="Vehicle type" name="vehicle-type" onChange={(event) => setVehicleType(event.currentTarget.value)} required value={vehicleType} />
            <InputField label="Vehicle number" name="vehicle-number" onChange={(event) => setVehicleNumber(event.currentTarget.value)} required value={vehicleNumber} />
          </div>
          <label className="flex items-center gap-3 text-sm font-medium">
            <input checked={availability} onChange={(event) => setAvailability(event.currentTarget.checked)} type="checkbox" />
            Available to receive delivery assignments
          </label>
          <Button disabled={busy} type="submit">{busy ? "Saving…" : "Save profile"}</Button>
        </form>
      </Card>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <p><span className="block text-xs text-slate-500">{label}</span><span className="mt-1 block font-medium text-charcoal">{value}</span></p>;
}
