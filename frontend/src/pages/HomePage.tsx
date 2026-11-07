import { SiteHeader } from "../components/SiteHeader";
import { ApiStatus } from "../components/ApiStatus";

export function HomePage() {
  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <section className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-leaf">
            Food rescue, connected
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-forest sm:text-6xl">
            Good food belongs on a table, not in a landfill.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
            FoodBridge brings donors, community organizations, and delivery
            partners together to help surplus food reach the people who need it.
          </p>
        </section>

        <section aria-labelledby="system-status" className="mt-14 max-w-xl">
          <h2
            className="mb-3 text-lg font-semibold text-slate-900"
            id="system-status"
          >
            System status
          </h2>
          <ApiStatus />
        </section>
      </main>
      <footer className="border-t border-forest/10">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-slate-600">
          FoodBridge · Connecting surplus with need.
        </div>
      </footer>
    </div>
  );
}
