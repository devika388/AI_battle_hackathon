import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

export function AuthLayout({
  eyebrow = "FoodBridge community",
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { configError } = useAuth();

  return (
    <main className="min-h-screen bg-cream px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <Link
          className="inline-flex items-center gap-2 text-lg font-bold tracking-tight text-forest"
          to="/"
        >
          <span
            aria-hidden="true"
            className="grid h-9 w-9 place-items-center rounded-xl bg-sage/35 text-base"
          >
            F
          </span>
          FOODBRIDGE
        </Link>

        <div className="mt-8 grid overflow-hidden rounded-[2rem] border border-charcoal/8 bg-white shadow-soft lg:mt-12 lg:grid-cols-[0.85fr_1.15fr]">
          <aside className="relative hidden min-h-[34rem] overflow-hidden bg-[#edf1e8] p-10 lg:flex lg:flex-col lg:justify-between">
            <div
              aria-hidden="true"
              className="absolute -right-28 -top-20 h-80 w-80 rounded-full border-[40px] border-white/50"
            />
            <div className="relative">
              <p className="ds-label text-forest">{eyebrow}</p>
              <h2 className="mt-5 max-w-sm text-4xl font-semibold leading-tight tracking-[-0.04em] text-charcoal">
                Good food goes further when we work together.
              </h2>
            </div>
            <div className="relative rounded-2xl bg-white/70 p-5">
              <p className="text-sm font-medium leading-6 text-slate-600">
                Your account helps connect surplus food with people and
                communities who need it.
              </p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-forest">
                Don’t waste it. Bridge it.
              </p>
            </div>
          </aside>

          <section className="px-5 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-12">
            <p className="ds-label text-forest">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-charcoal sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
              {description}
            </p>

            {configError ? (
              <div
                className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950"
                role="alert"
              >
                {configError}
              </div>
            ) : null}

            <div className="mt-7">{children}</div>
          </section>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          By continuing, you agree to use FoodBridge responsibly and help keep
          food rescue safe for everyone.
        </p>
      </div>
    </main>
  );
}

export function FormMessage({
  message,
  tone = "error",
}: {
  message: string;
  tone?: "error" | "success" | "info";
}) {
  const styles = {
    error: "border-[#efc8c3] bg-[#fbefed] text-[#873c35]",
    success: "border-emerald-200 bg-[#f2f7ef] text-forest",
    info: "border-[#c9dce4] bg-[#eff6f8] text-[#355463]",
  };
  return (
    <div
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`rounded-xl border px-4 py-3 text-sm leading-6 ${styles[tone]}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {message}
    </div>
  );
}

export function FormSubmit({
  children,
  loading,
  disabled,
}: {
  children: ReactNode;
  loading: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-forest px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#294b39] disabled:cursor-not-allowed disabled:opacity-55"
      disabled={loading || disabled}
      type="submit"
    >
      {loading ? (
        <>
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          />
          Please wait…
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function preventNativeSubmit(
  event: FormEvent<HTMLFormElement>,
): FormData {
  event.preventDefault();
  return new FormData(event.currentTarget);
}
