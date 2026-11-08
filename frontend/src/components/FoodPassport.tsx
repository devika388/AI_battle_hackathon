import { useMemo } from "react";

export interface FoodPassportEvent {
  status: string | null;
  description: string | null;
  updated_at: string;
  responsible_user_id?: string | null;
  responsible_user?: { full_name: string | null } | null;
  location?: string | null;
}

const milestones = [
  { status: "available", label: "Donation created", icon: "＋" },
  { status: "ngo_matching_started", label: "NGO matching started", icon: "⌕" },
  { status: "matched", label: "NGO accepted", icon: "✓" },
  { status: "partner_assigned", label: "Partner assigned", icon: "↗" },
  { status: "picked_up", label: "Food picked up", icon: "▣" },
  { status: "in_transit", label: "In transit", icon: "→" },
  { status: "delivered", label: "Delivered", icon: "⌖" },
  { status: "completed", label: "NGO confirmed receipt", icon: "✓" },
  { status: "rescue_completed", label: "Rescue completed", icon: "✳" },
] as const;

const milestoneAliases: Record<string, string[]> = {
  available: ["available"],
  ngo_matching_started: ["ngo_matching_started"],
  matched: ["matched", "accepted"],
  partner_assigned: ["partner_assigned"],
  picked_up: ["picked_up"],
  in_transit: ["in_transit"],
  delivered: ["delivered"],
  completed: ["completed", "ngo_confirmed_receipt"],
  rescue_completed: ["rescue_completed"],
};

const progressForStatus: Record<string, number> = {
  available: 0,
  matched: 2,
  accepted: 2,
  assigned: 3,
  picked_up: 4,
  delivered: 6,
  completed: 7,
};

function labelForStatus(status: string) {
  const labels: Record<string, string> = {
    available: "Donation created",
    ngo_matching_started: "NGO matching started",
    matched: "NGO accepted",
    accepted: "NGO accepted",
    partner_assigned: "Partner assigned",
    picked_up: "Food picked up",
    in_transit: "In transit",
    arrived: "Arrived at NGO",
    delivered: "Delivered",
    completed: "NGO confirmed receipt",
    ngo_confirmed_receipt: "NGO confirmed receipt",
    rescue_search_started: "Community rescue search started",
    rescue_ngo_notified: "Suitable NGOs notified",
    rescue_search_expanded: "Rescue search expanded",
    rescue_reminder_sent: "NGO reminder sent",
    rescue_assigned: "Rescue assignment recorded",
    rescue_completed: "Rescue completed",
    rescue_blocked: "Rescue blocked",
  };
  if (labels[status]) return labels[status];
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time not recorded"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusIcon(status: string | null) {
  if (status === "rescue_blocked") return "!";
  const milestone = milestones.find((item) =>
    milestoneAliases[item.status].includes(status ?? ""),
  );
  if (milestone) return milestone.icon;
  if (status?.startsWith("rescue_")) return "✳";
  return "•";
}

export function FoodPassport({
  donationId,
  donationStatus,
  events,
}: {
  donationId: string;
  donationStatus: string;
  events: FoodPassportEvent[];
}) {
  const timeline = useMemo(
    () => [...events].sort((left, right) =>
      new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime(),
    ),
    [events],
  );
  const phase = progressForStatus[donationStatus] ?? -1;
  const latestEventIndex = timeline.length - 1;
  const completedMilestones = milestones.filter((milestone) =>
    timeline.some((event) => milestoneAliases[milestone.status].includes(event.status ?? "")),
  );
  const lastMilestone = Math.max(-1, ...timeline.map((event) =>
    milestones.findIndex((milestone) => milestoneAliases[milestone.status].includes(event.status ?? "")),
  ));
  const currentProgress = Math.max(phase, lastMilestone);
  const terminal = ["cancelled", "expired"].includes(donationStatus) ||
    timeline[latestEventIndex]?.status === "rescue_blocked";
  const pendingMilestones = terminal ? [] : milestones.filter((milestone, index) =>
    !completedMilestones.some((completed) => completed.status === milestone.status) &&
    index > Math.max(phase, lastMilestone),
  );

  return (
    <section aria-label="Food passport" className="rounded-2xl border border-charcoal/8 bg-white p-5 shadow-card sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="ds-label text-forest">Food passport</p>
          <h2 className="mt-1 text-lg font-semibold text-charcoal">Donation journey</h2>
        </div>
        <span className="rounded-full bg-[#eaf0e7] px-3 py-1 font-mono text-[0.68rem] text-forest">{donationId}</span>
      </div>
      <div aria-label={`Donation is ${labelForStatus(donationStatus)}`} className="mt-5">
        <div className="h-2 overflow-hidden rounded-full bg-[#edf0e9]">
          <div className="h-full rounded-full bg-forest transition-[width]" style={{ width: `${Math.max(4, ((currentProgress + 1) / milestones.length) * 100)}%` }} />
        </div>
        <p className="mt-2 text-xs font-medium text-slate-500">Current status: {timeline[latestEventIndex]?.status ? labelForStatus(timeline[latestEventIndex].status!) : labelForStatus(donationStatus)}</p>
      </div>
      <ol className="mt-6">
        {timeline.map((event, index) => {
          const current = index === latestEventIndex;
          return (
            <li className="relative flex gap-4 pb-6 last:pb-0" key={`${event.updated_at}-${event.status}-${index}`}>
              {index < timeline.length - 1 || pendingMilestones.length > 0
                ? <span aria-hidden="true" className="absolute left-[0.72rem] top-8 h-[calc(100%-1rem)] w-px bg-sage/60" />
                : null}
              <span className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs ${current ? "border-forest bg-forest font-bold text-white ring-4 ring-[#eaf0e7]" : "border-sage bg-white text-forest"}`}>
                {statusIcon(event.status)}
              </span>
              <div className={`min-w-0 flex-1 rounded-xl p-3 ${current ? "bg-[#f1f5ee]" : "bg-white"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={`text-sm font-semibold ${current ? "text-forest" : "text-charcoal"}`}>{labelForStatus(event.status ?? "update")}</p>
                  {current ? <span className="rounded-full bg-forest px-2 py-0.5 text-[0.65rem] font-semibold text-white">Current</span> : null}
                </div>
                <p className="mt-1 text-sm leading-5 text-slate-600">{event.description || "Donation status updated."}</p>
                <p className="mt-2 text-xs text-slate-500">{dateLabel(event.updated_at)}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                  {event.responsible_user?.full_name
                    ? <span>By {event.responsible_user.full_name}</span>
                    : event.status?.startsWith("rescue_")
                      ? <span>By FoodBridge operations</span>
                      : null}
                  {event.location ? <span>Location: {event.location}</span> : null}
                </div>
              </div>
            </li>
          );
        })}
        {!timeline.length ? <li className="pb-5 text-sm text-slate-500">No timeline events have been recorded yet.</li> : null}
        {pendingMilestones.map((milestone, index) => (
          <li className="relative flex gap-4 pb-5 last:pb-0" key={milestone.status}>
            {index < pendingMilestones.length - 1 ? <span aria-hidden="true" className="absolute left-[0.72rem] top-8 h-[calc(100%-1rem)] w-px border-l border-dashed border-slate-300" /> : null}
            <span className="relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-dashed border-slate-300 bg-[#fafaf7] text-[0.65rem] text-slate-400">{milestone.icon}</span>
            <div className="flex-1 rounded-xl border border-dashed border-slate-200 bg-[#fafaf7] p-3">
              <p className="text-sm font-medium text-slate-400">{milestone.label}</p>
              <p className="mt-1 text-xs text-slate-400">Pending</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-5 border-t border-charcoal/8 pt-4 text-xs leading-5 text-slate-500">
        FoodBridge records donor-provided preparation and expiry details and coordinates handoffs. It does not certify food safety.
      </p>
    </section>
  );
}
