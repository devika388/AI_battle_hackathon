import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Badge, Button, Card } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { dashboardErrorMessage, dashboardRequest } from "../../services/dashboardApi";
import type { NotificationItem } from "../../types/food";
import {
  DashboardHeading, DashboardShell, DashboardState, StatCard, useDashboardTab,
} from "./DashboardShell";

type UserRecord = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  is_suspended: boolean;
  donor: { organization_name: string | null; city: string | null } | null;
  ngo: { organization_name: string | null; city: string | null; is_verified: boolean; verification_status: string; verification_notes: string | null } | null;
  partner: { id: string; vehicle_type: string | null; vehicle_number: string | null; availability: boolean; verification_status: string; verification_notes: string | null } | null;
};

type DonationRecord = {
  id: string;
  food_name: string;
  food_category: string;
  quantity: number;
  quantity_unit: string;
  status: string;
  expiry_time: string;
  created_at: string;
  pickup_address: string;
  city: string | null;
  donor_profiles?: { organization_name: string | null } | null;
};

type AssignmentRecord = {
  id: string;
  donation_id: string;
  ngo_id: string | null;
  partner_id: string | null;
  status: string;
  delivery_stage?: string;
  donations?: { food_name: string; status: string; expiry_time: string } | null;
  ngo_profiles?: { organization_name: string | null } | null;
  partner_profiles?: { vehicle_type: string | null; vehicle_number: string | null } | null;
};

type RescueRequest = {
  id: string;
  status: string;
  created_at: string;
  description?: string | null;
  donation_id?: string | null;
  assigned_partner_id?: string | null;
  donations?: { food_name: string; status: string; donor_id: string } | null;
};

type AdminReport = {
  summary: {
    total_users: number;
    total_donations: number;
    active_ngos: number;
    active_partners: number;
    successful_rescues: number;
    pending_requests: number;
    food_saved_kg: number;
    meals_provided: number;
  };
  donations_over_time: { date: string; donations: number }[];
  impact_over_time: { date: string; food_saved_kg: number; meals_provided: number }[];
  food_categories: { category: string; donations: number }[];
  ngo_performance: { name: string; assigned: number; completed: number }[];
  delivery_performance: { name: string; assigned: number; completed: number }[];
};

const colors = ["#24583e", "#8ba98a", "#d9b754", "#cb7d66", "#7799a6", "#9c83a5", "#b2a081"];

async function loadAllPages<T>(path: string, field: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const query = `${path}${path.includes("?") ? "&" : "?"}limit=100&offset=${offset}`;
    const page = await dashboardRequest<Record<string, T[]>>(query);
    const batch = page[field] ?? [];
    rows.push(...batch);
    if (batch.length < 100) return rows;
  }
}

function dateLabel(value?: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AdminDashboard() {
  const { profile } = useAuth();
  const { tab, selectTab } = useDashboardTab("admin");
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [requests, setRequests] = useState<RescueRequest[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [report, setReport] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [userRows, donationRows, assignmentRows, requestRows, reportResult, notificationResult] = await Promise.all([
        loadAllPages<UserRecord>("/admin/users", "users"),
        loadAllPages<DonationRecord>("/admin/donations", "donations"),
        loadAllPages<AssignmentRecord>("/admin/assignments", "assignments"),
        loadAllPages<RescueRequest>("/admin/rescue-requests", "rescue_requests"),
        dashboardRequest<{ report: AdminReport }>("/admin/reports"),
        dashboardRequest<{ notifications: NotificationItem[] }>("/notifications?limit=50"),
      ]);
      setUsers(userRows);
      setDonations(donationRows);
      setAssignments(assignmentRows);
      setRequests(requestRows);
      setReport(reportResult.report);
      setNotifications(notificationResult.notifications);
    } catch (loadError) {
      setError(dashboardErrorMessage(loadError, "Could not load administrative data."));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <DashboardShell role="admin" activeTab={tab} onTabChange={selectTab}>
      {tab === "overview" ? <Overview report={report} users={users} donations={donations} assignments={assignments} requests={requests} loading={loading} error={error} onRetry={load} onSelect={selectTab} /> : null}
      {["users", "donors", "ngos", "partners"].includes(tab) ? (
        <UsersSection
          tab={tab}
          users={users}
          loading={loading}
          error={error}
          onRetry={load}
          onChanged={load}
        />
      ) : null}
      {tab === "adminDonations" ? <DonationsSection items={donations} loading={loading} error={error} onRetry={load} /> : null}
      {tab === "adminAssignments" ? <AssignmentsSection items={assignments} loading={loading} error={error} onRetry={load} /> : null}
      {tab === "requests" ? <RequestsSection items={requests} partners={users.filter((user) => user.role === "delivery_partner" && !user.is_suspended)} loading={loading} error={error} onRetry={load} onChanged={load} /> : null}
      {tab === "reports" ? <Reports report={report} loading={loading} error={error} onRetry={load} /> : null}
      {tab === "notifications" ? <AdminNotifications items={notifications} loading={loading} error={error} onRetry={load} onChanged={load} /> : null}
      {tab === "settings" ? <Settings email={profile?.email ?? ""} fullName={profile?.full_name ?? ""} /> : null}
    </DashboardShell>
  );
}

function Overview({
  report, users, donations, assignments, requests, loading, error, onRetry, onSelect,
}: {
  report: AdminReport | null;
  users: UserRecord[];
  donations: DonationRecord[];
  assignments: AssignmentRecord[];
  requests: RescueRequest[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onSelect: (tab: "users" | "adminDonations" | "adminAssignments" | "requests" | "reports") => void;
}) {
  const summary = report?.summary;
  const pendingApprovals = users.filter((item) =>
    (item.role === "ngo" && item.ngo?.verification_status === "pending") ||
    (item.role === "delivery_partner_pending" && item.partner?.verification_status === "pending"),
  ).length;
  return (
    <>
      <DashboardHeading eyebrow="Platform operations" title="FoodBridge control room." description="Monitor verified accounts, food rescue, delivery operations, and recorded community impact." action={<Button variant="secondary" onClick={() => onSelect("reports")}>Open reports</Button>} />
      {loading || error ? <DashboardState loading={loading} error={error} onRetry={onRetry} /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total users" value={summary?.total_users ?? 0} note={`${pendingApprovals} pending verification`} />
            <StatCard label="Total donations" value={summary?.total_donations ?? 0} note="All recorded donations" tone="powder" />
            <StatCard label="Active NGOs" value={summary?.active_ngos ?? 0} note="Verified organizations" tone="sage" />
            <StatCard label="Active partners" value={summary?.active_partners ?? 0} note="Approved delivery partners" tone="butter" />
            <StatCard label="Successful rescues" value={summary?.successful_rescues ?? 0} note="Receipt-confirmed deliveries" tone="blush" />
            <StatCard label="Pending requests" value={summary?.pending_requests ?? 0} note="Open rescue requests" />
            <StatCard label="Food saved" value={`${Number(summary?.food_saved_kg ?? 0).toLocaleString()} kg`} note="Recorded impact records" tone="sage" />
            <StatCard label="Meals provided" value={Number(summary?.meals_provided ?? 0).toLocaleString()} note="Recorded impact records" tone="powder" />
          </div>
          <div className="mt-7 grid gap-5 xl:grid-cols-3">
            <Card className="p-5 xl:col-span-2">
              <div className="flex items-center justify-between"><div><h2 className="font-semibold">Recent platform activity</h2><p className="mt-1 text-xs text-slate-500">Latest donations and delivery assignments</p></div><button className="text-sm font-semibold text-forest" onClick={() => onSelect("adminDonations")} type="button">View donations</button></div>
              <div className="mt-4 divide-y divide-charcoal/8">
                {donations.slice(0, 4).map((donation) => <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={donation.id}><div><p className="font-medium">{donation.food_name}</p><p className="mt-1 text-xs text-slate-500">{donation.city ?? donation.pickup_address} · {dateLabel(donation.created_at)}</p></div><Badge tone={donation.status === "completed" ? "forest" : "neutral"}>{titleCase(donation.status)}</Badge></div>)}
                {!donations.length ? <p className="py-4 text-sm text-slate-500">No donations recorded.</p> : null}
              </div>
            </Card>
            <Card className="p-5">
              <h2 className="font-semibold">Needs attention</h2>
              <button className="mt-4 flex w-full items-center justify-between rounded-xl bg-[#f7f6f0] p-3 text-left" onClick={() => onSelect("users")} type="button"><span className="text-sm">Applications to review</span><strong>{pendingApprovals}</strong></button>
              <button className="mt-2 flex w-full items-center justify-between rounded-xl bg-[#f7f6f0] p-3 text-left" onClick={() => onSelect("adminDonations")} type="button"><span className="text-sm">Unaccepted donations</span><strong>{donations.filter((item) => item.status === "available" && new Date(item.expiry_time) > new Date()).length}</strong></button>
              <button className="mt-2 flex w-full items-center justify-between rounded-xl bg-[#f7f6f0] p-3 text-left" onClick={() => onSelect("adminAssignments")} type="button"><span className="text-sm">Unassigned deliveries</span><strong>{assignments.filter((item) => item.status === "accepted" && !item.partner_id).length}</strong></button>
              <button className="mt-2 flex w-full items-center justify-between rounded-xl bg-[#f7f6f0] p-3 text-left" onClick={() => onSelect("requests")} type="button"><span className="text-sm">Open rescue requests</span><strong>{requests.filter((item) => item.status === "open").length}</strong></button>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

function UsersSection({
  tab, users, loading, error, onRetry, onChanged,
}: {
  tab: string;
  users: UserRecord[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const filterRole = tab === "donors" ? "donor" : tab === "ngos" ? "ngo" : tab === "partners" ? "delivery_partner" : null;
  const title = tab === "donors" ? "Donors" : tab === "ngos" ? "NGO management" : tab === "partners" ? "Delivery partners" : "User management";
  const filtered = users.filter((user) => {
    const roleMatches = !filterRole || (filterRole === "delivery_partner" ? ["delivery_partner", "delivery_partner_pending"].includes(user.role) : user.role === filterRole);
    const details = user.ngo?.organization_name ?? user.donor?.organization_name ?? "";
    const text = `${user.full_name ?? ""} ${user.email ?? ""} ${user.id} ${user.role} ${details}`.toLowerCase();
    return roleMatches && (!query || text.includes(query.toLowerCase()));
  });
  const action = async (user: UserRecord, kind: "approve" | "reject" | "suspend" | "reactivate") => {
    setBusy(user.id);
    setActionError("");
    try {
      if (kind === "approve") {
        const path = user.role === "ngo" ? `/admin/ngos/${user.id}/verify` : `/admin/partners/${user.id}/verify`;
        await dashboardRequest(path, { method: "POST" });
      } else if (kind === "reject") {
        const reason = window.prompt("Reason for rejecting this verification:");
        if (!reason?.trim()) return;
        const kindPath = user.role === "ngo" ? "ngos" : "partners";
        await dashboardRequest(`/admin/${kindPath}/${user.id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reason.trim() }) });
      } else {
        await dashboardRequest(`/admin/users/${user.id}/suspension`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_suspended: kind === "suspend" }) });
      }
      onChanged();
    } catch (failure) { setActionError(dashboardErrorMessage(failure, "Could not update this account.")); }
    finally { setBusy(""); }
  };
  return (
    <>
      <DashboardHeading eyebrow="Identity and access" title={title} description="Review profile details, verification status, and account access. All changes are enforced by administrator-only API routes." />
      <input aria-label="Search users" className="ds-field mb-5" onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search name, email, organization, or user ID" value={query} />
      {actionError ? <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-800" role="alert">{actionError}</p> : null}
      {loading || error ? <DashboardState loading={loading} error={error} onRetry={onRetry} /> : !filtered.length ? <DashboardState empty /> : (
        <div className="space-y-3">{filtered.map((user) => <UserCard key={user.id} user={user} busy={busy === user.id} onAction={(kind) => void action(user, kind)} />)}</div>
      )}
    </>
  );
}

function UserCard({ user, busy, onAction }: { user: UserRecord; busy: boolean; onAction: (action: "approve" | "reject" | "suspend" | "reactivate") => void }) {
  const approval = user.ngo?.verification_status ?? user.partner?.verification_status ?? (user.role === "delivery_partner" ? "approved" : null);
  const organization = user.ngo?.organization_name ?? user.donor?.organization_name;
  const canReview = (user.role === "ngo" && !user.ngo?.is_verified && approval !== "approved") || (user.role === "delivery_partner_pending" && ["pending", "rejected"].includes(approval ?? ""));
  const isPending = user.role === "delivery_partner_pending" || (user.role === "ngo" && !user.ngo?.is_verified);
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[14rem] flex-1">
          <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{user.full_name ?? "Unnamed user"}</h2><Badge tone={user.is_suspended ? "danger" : isPending ? "butter" : "sage"}>{user.is_suspended ? "Suspended" : titleCase(user.role)}</Badge>{approval ? <Badge tone={approval === "approved" ? "forest" : approval === "rejected" ? "danger" : "neutral"}>{titleCase(approval)}</Badge> : null}</div>
          <p className="mt-1 text-sm text-slate-600">{user.email ?? "No email"} · {user.phone ?? "No phone"}</p>
          <p className="mt-1 text-sm text-slate-500">{organization ?? (user.partner ? `${user.partner.vehicle_type ?? "Vehicle"} · ${user.partner.vehicle_number ?? "No vehicle number"}` : "No organization details")}</p>
          <p className="mt-1 truncate font-mono text-[0.68rem] text-slate-400">{user.id}</p>
          {approval === "rejected" && (user.ngo?.verification_notes ?? user.partner?.verification_notes) ? <p className="mt-2 text-sm text-red-700">Review note: {user.ngo?.verification_notes ?? user.partner?.verification_notes}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {canReview ? <><Button disabled={busy} onClick={() => onAction("approve")} size="sm">Approve</Button><Button disabled={busy} onClick={() => onAction("reject")} size="sm" variant="destructive">Reject</Button></> : null}
          {user.role !== "admin" ? <Button disabled={busy} onClick={() => onAction(user.is_suspended ? "reactivate" : "suspend")} size="sm" variant="secondary">{user.is_suspended ? "Reactivate" : "Suspend"}</Button> : null}
        </div>
      </div>
      <details className="mt-3 border-t border-charcoal/8 pt-3">
        <summary className="cursor-pointer text-xs font-semibold text-forest">View account details</summary>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <p>City: {user.ngo?.city ?? user.donor?.city ?? "Not set"}</p>
          <p>Partner availability: {user.partner ? (user.partner.availability ? "Available" : "Unavailable") : "—"}</p>
          <p>Verification: {approval ?? "Not applicable"}</p>
        </div>
      </details>
    </Card>
  );
}

function DonationsSection({ items, loading, error, onRetry }: { items: DonationRecord[]; loading: boolean; error: string; onRetry: () => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = useMemo(() => items.filter((item) => {
    const text = `${item.food_name} ${item.id} ${item.city ?? ""} ${item.donor_profiles?.organization_name ?? ""}`.toLowerCase();
    return (status === "all" || item.status === status) && (!query || text.includes(query.toLowerCase()));
  }), [items, query, status]);
  return (
    <>
      <DashboardHeading eyebrow="Food inventory" title="Donation management" description="Search real donation records, inspect status and expiry, and quickly identify unaccepted or expired food." />
      <div className="mb-5 grid gap-3 sm:grid-cols-2"><input aria-label="Search donations" className="ds-field" onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search food, donor, city, or ID" value={query} /><select aria-label="Filter donation status" className="ds-field" onChange={(event) => setStatus(event.currentTarget.value)} value={status}><option value="all">All statuses</option>{["available", "matched", "assigned", "picked_up", "delivered", "completed", "cancelled", "expired"].map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select></div>
      {loading || error ? <DashboardState loading={loading} error={error} onRetry={onRetry} /> : !filtered.length ? <DashboardState empty /> : (
        <div className="space-y-3">{filtered.map((item) => {
          const expired = new Date(item.expiry_time) <= new Date() && !["completed", "cancelled", "expired"].includes(item.status);
          return <Card className="p-4 sm:p-5" key={item.id}>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{item.food_name}</h2><p className="mt-1 text-sm text-slate-600">{item.quantity} {item.quantity_unit} · {item.food_category} · {item.city ?? item.pickup_address}</p><p className="mt-1 text-xs text-slate-500">Donor: {item.donor_profiles?.organization_name ?? "FoodBridge donor"} · Created {dateLabel(item.created_at)}</p><p className="mt-1 font-mono text-[0.68rem] text-slate-400">{item.id}</p></div><div className="flex items-center gap-2"><Badge tone={expired ? "danger" : item.status === "completed" ? "forest" : "neutral"}>{expired ? "Expired" : titleCase(item.status)}</Badge></div></div>
            <details className="mt-3 border-t border-charcoal/8 pt-3"><summary className="cursor-pointer text-xs font-semibold text-forest">Donation details</summary><p className="mt-2 text-sm text-slate-600">Pickup: {item.pickup_address}, {item.city ?? ""} · Expires {dateLabel(item.expiry_time)}</p></details>
          </Card>;
        })}</div>
      )}
    </>
  );
}

function AssignmentsSection({ items, loading, error, onRetry }: { items: AssignmentRecord[]; loading: boolean; error: string; onRetry: () => void }) {
  const [query, setQuery] = useState("");
  const filtered = items.filter((item) => `${item.donations?.food_name ?? ""} ${item.donation_id} ${item.ngo_profiles?.organization_name ?? ""} ${item.partner_profiles?.vehicle_number ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <DashboardHeading eyebrow="Rescue operations" title="Assignment monitoring" description="Monitor the assigned NGO, delivery partner, assignment state, and latest delivery checkpoint." />
      <input aria-label="Search assignments" className="ds-field mb-5" onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search donation, NGO, partner, or ID" value={query} />
      {loading || error ? <DashboardState loading={loading} error={error} onRetry={onRetry} /> : !filtered.length ? <DashboardState empty /> : (
        <div className="space-y-3">{filtered.map((item) => <Card className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4" key={item.id}>
          <Field label="Donation" value={item.donations?.food_name ?? item.donation_id} />
          <Field label="NGO" value={item.ngo_profiles?.organization_name ?? "Not assigned"} />
          <Field label="Delivery partner" value={item.partner_profiles?.vehicle_number ?? (item.partner_id ? item.partner_profiles?.vehicle_type ?? "Assigned" : "Awaiting partner")} />
          <Field label="Status / stage" value={`${titleCase(item.status)} / ${titleCase(item.delivery_stage ?? item.status)}`} />
        </Card>)}</div>
      )}
    </>
  );
}

function RequestsSection({
  items, partners, loading, error, onRetry, onChanged,
}: {
  items: RescueRequest[];
  partners: UserRecord[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onChanged: () => void;
}) {
  const [values, setValues] = useState<Record<string, { status: string; partnerId: string }>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [busy, setBusy] = useState("");
  const update = async (item: RescueRequest) => {
    const value = values[item.id] ?? { status: item.status, partnerId: item.assigned_partner_id ?? "" };
    setBusy(item.id);
    setErrorMessage("");
    try {
      await dashboardRequest(`/admin/rescue-requests/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: value.status, assigned_partner_id: value.status === "assigned" ? value.partnerId : null }),
      });
      onChanged();
    } catch (failure) { setErrorMessage(dashboardErrorMessage(failure, "Could not update rescue request.")); }
    finally { setBusy(""); }
  };
  return (
    <>
      <DashboardHeading eyebrow="Community operations" title="Rescue requests" description="Review request status and assign an approved delivery partner when a request moves to assigned." />
      {errorMessage ? <p className="mb-4 text-sm text-red-700" role="alert">{errorMessage}</p> : null}
      {loading || error ? <DashboardState loading={loading} error={error} onRetry={onRetry} /> : !items.length ? <DashboardState empty /> : (
        <div className="space-y-3">{items.map((item) => {
          const value = values[item.id] ?? { status: item.status, partnerId: item.assigned_partner_id ?? "" };
          return <Card className="p-4 sm:p-5" key={item.id}>
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">{item.donations?.food_name ?? "Rescue request"}</h2><p className="mt-1 text-xs text-slate-500">Created {dateLabel(item.created_at)} · Request {item.id}</p></div><Badge tone={value.status === "resolved" ? "forest" : "butter"}>{titleCase(value.status)}</Badge></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <select aria-label="Rescue request status" className="ds-field" onChange={(event) => setValues((current) => ({ ...current, [item.id]: { ...value, status: event.currentTarget.value } }))} value={value.status}><option value="open">Open</option><option value="assigned">Assigned</option><option value="resolved">Resolved</option><option value="cancelled">Cancelled</option></select>
              <select aria-label="Assigned delivery partner" className="ds-field" onChange={(event) => setValues((current) => ({ ...current, [item.id]: { ...value, partnerId: event.currentTarget.value } }))} value={value.partnerId}><option value="">Select approved partner</option>{partners.map((partner) => <option key={partner.partner?.id ?? partner.id} value={partner.partner?.id ?? ""}>{partner.full_name ?? partner.email ?? partner.id} · {partner.partner?.vehicle_type ?? "Partner"}</option>)}</select>
              <Button disabled={busy === item.id} onClick={() => void update(item)} size="sm">{busy === item.id ? "Saving…" : "Save request"}</Button>
            </div>
          </Card>;
        })}</div>
      )}
    </>
  );
}

function Reports({ report, loading, error, onRetry }: { report: AdminReport | null; loading: boolean; error: string; onRetry: () => void }) {
  return (
    <>
      <DashboardHeading eyebrow="Recorded outcomes" title="Reports & analytics" description="Charts are computed from the platform’s donation, assignment, NGO, partner, and impact records." />
      {loading || error ? <DashboardState loading={loading} error={error} onRetry={onRetry} /> : !report ? <DashboardState empty /> : (
        <div className="grid gap-5 xl:grid-cols-2">
          <ChartCard title="Donations over time" subtitle="Recorded creation dates">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={report.donations_over_time}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" minTickGap={24} /><YAxis allowDecimals={false} /><Tooltip /><Line dataKey="donations" stroke="#24583e" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Food rescued & meals" subtitle="Actual impact records grouped by donation date">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={report.impact_over_time}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" minTickGap={24} /><YAxis /><Tooltip /><Line dataKey="food_saved_kg" name="Food saved (kg)" stroke="#24583e" strokeWidth={2} /><Line dataKey="meals_provided" name="Meals provided" stroke="#d9b754" strokeWidth={2} /></LineChart></ResponsiveContainer>
          </ChartCard>
          <ChartCard title="NGO performance" subtitle="Assignments vs. receipt-confirmed deliveries">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={report.ngo_performance.slice(0, 10)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" minTickGap={18} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="assigned" fill="#8ba98a" /><Bar dataKey="completed" fill="#24583e" /></BarChart></ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Delivery performance" subtitle="Assigned vs. completed deliveries">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={report.delivery_performance.slice(0, 10)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" minTickGap={18} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="assigned" fill="#d9b754" /><Bar dataKey="completed" fill="#24583e" /></BarChart></ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Food category distribution" subtitle="Donation count by category">
            <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={report.food_categories} dataKey="donations" nameKey="category" outerRadius={105} label>{report.food_categories.map((entry, index) => <Cell fill={colors[index % colors.length]} key={entry.category} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
          </ChartCard>
          <Card className="p-5"><h2 className="font-semibold">Report totals</h2><div className="mt-4 grid grid-cols-2 gap-3"><StatCard label="Food rescued" value={`${Number(report.summary.food_saved_kg).toLocaleString()} kg`} /><StatCard label="Meals provided" value={Number(report.summary.meals_provided).toLocaleString()} tone="butter" /></div><p className="mt-4 text-xs leading-5 text-slate-500">Impact values come from impact_records. No synthetic or estimated values are included.</p></Card>
        </div>
      )}
    </>
  );
}

function AdminNotifications({ items, loading, error, onRetry, onChanged }: { items: NotificationItem[]; loading: boolean; error: string; onRetry: () => void; onChanged: () => void }) {
  const [message, setMessage] = useState("");
  const readAll = async () => {
    try {
      await dashboardRequest("/notifications/read-all", { method: "POST" });
      onChanged();
    } catch (failure) { setMessage(dashboardErrorMessage(failure, "Could not mark notifications read.")); }
  };
  return (
    <>
      <DashboardHeading eyebrow="Platform alerts" title="Notifications" action={<Button variant="secondary" onClick={() => void readAll()}>Mark all read</Button>} />
      {message ? <p className="mb-4 text-sm text-red-700" role="alert">{message}</p> : null}
      {loading || error ? <DashboardState loading={loading} error={error} onRetry={onRetry} /> : !items.length ? <DashboardState empty /> : <div className="space-y-3">{items.map((item) => <Card className="p-5" key={item.id}><h2 className="font-semibold">{item.title ?? "FoodBridge update"}</h2><p className="mt-1 text-sm text-slate-600">{item.message}</p><p className="mt-2 text-xs text-slate-400">{dateLabel(item.created_at)} · {item.is_read ? "Read" : "Unread"}</p></Card>)}</div>}
    </>
  );
}

function Settings({ email, fullName }: { email: string; fullName: string }) {
  return (
    <>
      <DashboardHeading eyebrow="Administrator access" title="Settings & security" description="Administrator role changes are not exposed in the application and must be provisioned through a trusted Supabase process." />
      <Card className="max-w-2xl p-5 sm:p-7"><h2 className="font-semibold">Signed-in administrator</h2><p className="mt-3 text-sm text-slate-600">{fullName}</p><p className="text-sm text-slate-600">{email}</p><p className="mt-5 rounded-xl bg-[#f7f6f0] p-4 text-sm leading-6 text-slate-600">All administrative operations are verified by backend role middleware. Never grant the admin role through public registration or frontend data.</p></Card>
    </>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <Card className="p-5"><h2 className="font-semibold">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p><div className="mt-4 h-64">{children}</div></Card>;
}

function Field({ label, value }: { label: string; value: string }) {
  return <p><span className="block text-xs text-slate-500">{label}</span><span className="mt-1 block text-sm font-medium">{value}</span></p>;
}
