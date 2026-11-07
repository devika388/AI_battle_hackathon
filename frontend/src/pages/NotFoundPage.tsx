import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-cream px-6 text-center">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-leaf">
          404
        </p>
        <h1 className="mt-3 text-3xl font-bold text-forest">Page not found</h1>
        <Link
          className="mt-6 inline-block font-semibold text-leaf underline underline-offset-4"
          to="/"
        >
          Return to FoodBridge
        </Link>
      </div>
    </main>
  );
}
