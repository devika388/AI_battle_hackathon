import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

export interface NavigationItem {
  label: string;
  to: string;
}

export function NavigationBar({
  brand = "FoodBridge",
  items = [],
  actions,
}: {
  brand?: string;
  items?: NavigationItem[];
  actions?: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="relative z-20 border-b border-charcoal/8 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex min-h-[4.5rem] max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link
          aria-label={`${brand} home`}
          className="shrink-0 text-xl font-bold tracking-tight text-forest"
          onClick={() => setMenuOpen(false)}
          to="/"
        >
          {brand}<span className="text-[#829f7c]">.</span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-7 md:flex">
          {items.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `text-sm font-medium ${isActive ? "text-forest" : "text-slate-600 hover:text-forest"}`
              }
              key={item.to}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">{actions}</div>
        <button
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          className="grid h-10 w-10 place-items-center rounded-xl text-forest hover:bg-forest/5 md:hidden"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          <svg
            aria-hidden="true"
            fill="none"
            height="21"
            viewBox="0 0 24 24"
            width="21"
          >
            {menuOpen ? (
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.8"
              />
            ) : (
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.8"
              />
            )}
          </svg>
        </button>
      </div>

      {menuOpen ? (
        <nav
          aria-label="Mobile navigation"
          className="animate-rise-in border-t border-charcoal/8 bg-cream px-5 py-4 md:hidden"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {items.map((item) => (
              <NavLink
                className={({ isActive }) =>
                  `rounded-xl px-3 py-3 text-sm font-medium ${isActive ? "bg-sage/25 text-forest" : "text-slate-600"}`
                }
                key={item.to}
                onClick={() => setMenuOpen(false)}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
            {actions ? <div className="mt-3 border-t border-charcoal/10 pt-4">{actions}</div> : null}
          </div>
        </nav>
      ) : null}
    </header>
  );
}

export function Sidebar({
  items,
  title = "Workspace",
}: {
  items: NavigationItem[];
  title?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <>
      <button
        aria-expanded={mobileOpen}
        className="mb-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-charcoal/10 bg-white px-4 text-sm font-semibold text-forest lg:hidden"
        onClick={() => setMobileOpen((open) => !open)}
        type="button"
      >
        <span aria-hidden="true">☰</span>
        {mobileOpen ? "Hide menu" : "Show menu"}
      </button>
      <aside
        aria-label={title}
        className={`${mobileOpen ? "block" : "hidden"} w-full shrink-0 rounded-2xl border border-charcoal/8 bg-white p-3 shadow-card lg:block lg:w-60`}
      >
        <p className="px-3 pb-3 pt-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
          {title}
        </p>
        <nav className="space-y-1">
          {items.map((item) => {
            const active =
              pathname === item.to ||
              (item.to !== "/" && pathname.startsWith(`${item.to}/`));
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`block rounded-xl px-3 py-2.5 text-sm font-medium ${active ? "bg-sage/25 text-forest" : "text-slate-600 hover:bg-cream hover:text-forest"}`}
                key={item.to}
                onClick={() => setMobileOpen(false)}
                to={item.to}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

export function DropdownMenu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <details className="group relative">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-charcoal/10 bg-white px-3.5 text-sm font-semibold text-charcoal hover:border-forest/25 [&::-webkit-details-marker]:hidden">
        {label}
        <svg
          aria-hidden="true"
          className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180"
          fill="none"
          viewBox="0 0 20 20"
        >
          <path
            d="m5 7.5 5 5 5-5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </svg>
      </summary>
      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 min-w-48 rounded-2xl border border-charcoal/10 bg-white p-2 shadow-soft">
        {children}
      </div>
    </details>
  );
}
