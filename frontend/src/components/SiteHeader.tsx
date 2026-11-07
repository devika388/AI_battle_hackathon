import { Link } from "react-router-dom";

export function SiteHeader() {
  return (
    <header className="border-b border-forest/10 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          aria-label="FoodBridge home"
          className="text-xl font-bold tracking-tight text-forest"
          to="/"
        >
          FoodBridge<span className="text-leaf">.</span>
        </Link>
        <span className="hidden text-sm text-slate-600 sm:inline">
          Don't waste it. Bridge it.
        </span>
      </div>
    </header>
  );
}
