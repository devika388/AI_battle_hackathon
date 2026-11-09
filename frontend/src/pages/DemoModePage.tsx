import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

type DemoRole = "donor" | "ngo" | "delivery_partner" | "admin";

const demoRoles: Array<{ id: DemoRole; label: string }> = [
  { id: "donor", label: "Food donor" },
  { id: "ngo", label: "NGO" },
  { id: "delivery_partner", label: "Delivery partner" },
  { id: "admin", label: "Admin" },
];

const dashboards: Record<
  DemoRole,
  {
    title: string;
    description: string;
    stats: Array<{ label: string; value: string }>;
    items: Array<{ title: string; detail: string; status: string }>;
  }
> = {
  donor: {
    title: "Donor dashboard",
    description: "A sample view of surplus food shared with the community.",
    stats: [
      { label: "Active donations", value: "3" },
      { label: "Food shared", value: "128 kg" },
      { label: "Successful pickups", value: "12" },
    ],
    items: [
      { title: "Seasonal vegetables", detail: "42 kg · Downtown", status: "Available" },
      { title: "Fresh bread", detail: "18 trays · Riverside", status: "Matched" },
      { title: "Prepared meals", detail: "36 portions · Midtown", status: "Collected" },
    ],
  },
  ngo: {
    title: "NGO dashboard",
    description: "A sample view of donations and community food needs.",
    stats: [
      { label: "Available matches", value: "5" },
      { label: "Food received", value: "84 kg" },
      { label: "Community meals", value: "210" },
    ],
    items: [
      { title: "Seasonal vegetables", detail: "42 kg · 2.4 km away", status: "Available" },
      { title: "Fresh bread", detail: "18 trays · 4.1 km away", status: "Available" },
      { title: "Prepared meals", detail: "36 portions · 1.8 km away", status: "Accepted" },
    ],
  },
  delivery_partner: {
    title: "Delivery partner dashboard",
    description: "A sample view of local pickups and delivery progress.",
    stats: [
      { label: "Open assignments", value: "2" },
      { label: "Completed deliveries", value: "8" },
      { label: "Distance covered", value: "34 km" },
    ],
    items: [
      { title: "Fresh bread pickup", detail: "Downtown → Riverside", status: "Ready for pickup" },
      { title: "Produce delivery", detail: "Market Street → Community Kitchen", status: "In transit" },
      { title: "Meal handoff", detail: "Midtown → Eastside Center", status: "Delivered" },
    ],
  },
  admin: {
    title: "Admin dashboard",
    description: "A sample overview of platform activity and verification queues.",
    stats: [
      { label: "Registered accounts", value: "146" },
      { label: "Pending reviews", value: "4" },
      { label: "Active donations", value: "18" },
    ],
    items: [
      { title: "Green Neighborhood Pantry", detail: "NGO verification · Submitted today", status: "Pending review" },
      { title: "City Cycle Couriers", detail: "Delivery partner · Submitted yesterday", status: "Pending review" },
      { title: "Surplus meal rescue", detail: "Community request · Midtown", status: "Open" },
    ],
  },
};

function readRole(value: string | null): DemoRole {
  return demoRoles.some((role) => role.id === value)
    ? (value as DemoRole)
    : "donor";
}

export function DemoModePage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const pathRole = location.pathname.includes("/ngo")
    ? "ngo"
    : location.pathname.includes("/delivery-partner")
      ? "delivery_partner"
      : location.pathname.includes("/admin")
        ? "admin"
      : null;
  const [role, setRole] = useState<DemoRole>(() =>
    readRole(searchParams.get("role") ?? pathRole),
  );
  const dashboard = dashboards[role];

  return (
    <main className="min-h-screen bg-cream px-4 py-8 text-charcoal sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link className="text-sm font-bold tracking-[0.16em] text-forest" to="/">
            FOODBRIDGE
          </Link>
          <span className="rounded-full bg-butter px-4 py-2 text-xs font-semibold text-charcoal">
            Demo mode · no login
          </span>
        </header>

        <section className="mt-10 rounded-3xl border border-forest/10 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-forest">
            Read-only preview
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {dashboard.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            {dashboard.description} These are sample figures; nothing here is
            connected to or saved in the database.
          </p>

          <div className="mt-7 flex flex-wrap gap-2" aria-label="Choose demo role">
            {demoRoles.map((option) => (
              <button
                aria-pressed={role === option.id}
                className={`min-h-10 rounded-full px-4 text-sm font-semibold transition ${
                  role === option.id
                    ? "bg-forest text-white"
                    : "border border-forest/15 bg-white text-forest hover:bg-forest/5"
                }`}
                key={option.id}
                onClick={() => setRole(option.id)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {dashboard.stats.map((stat) => (
              <article className="rounded-2xl bg-[#f7f6f0] p-5" key={stat.label}>
                <p className="text-sm text-slate-500">{stat.label}</p>
                <p className="mt-2 text-2xl font-semibold text-forest">{stat.value}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl border border-forest/10">
            <div className="border-b border-forest/10 px-5 py-4">
              <h2 className="font-semibold">
                {role === "admin" ? "Review queue and activity" : "Recent activity"}
              </h2>
            </div>
            <ul className="divide-y divide-forest/10">
              {dashboard.items.map((item) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                  key={item.title}
                >
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
                  </div>
                  <span className="rounded-full bg-sage/30 px-3 py-1 text-xs font-semibold text-forest">
                    {item.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-6 rounded-xl bg-[#fff9e8] px-4 py-3 text-sm leading-6 text-slate-600">
            Registration, sign-in, profile changes, and dashboard actions are
            disabled in this temporary demo. No database changes are made.
          </p>
        </section>
      </div>
    </main>
  );
}
