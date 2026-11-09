import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  AuthLayout,
  FormMessage,
  FormSubmit,
} from "../components/auth/AuthLayout";
import { InputField } from "../components/ui";
import { getSupabaseClient } from "../services/supabaseClient";
import { dashboardPath } from "../auth/routeGuards";

interface LoginLocationState {
  from?: { pathname?: string };
  message?: string;
}

export function LoginPage() {
  const {
    user,
    profile,
    ready,
    configError,
    sessionNotice,
    refreshProfile,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LoginLocationState | null;
  const [message, setMessage] = useState(state?.message ?? "");
  const [loading, setLoading] = useState(false);
  const [retryingProfile, setRetryingProfile] = useState(false);
  const [profileRetryError, setProfileRetryError] = useState("");

  if (!ready) {
    return (
      <AuthLayout
        eyebrow="Secure account"
        title="Checking your session."
        description="FoodBridge is restoring your saved sign-in before continuing."
      >
        <div
          aria-label="Checking session"
          className="h-1.5 w-full animate-pulse rounded-full bg-sage"
          role="status"
        />
      </AuthLayout>
    );
  }

  if (user && profile?.id === user.id) {
    return <Navigate replace to={dashboardPath(profile)} />;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (configError) return;
    setLoading(true);
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const { data, error } = await getSupabaseClient().auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMessage(
          /email not confirmed/i.test(error.message)
            ? "Email confirmation is still enabled in Supabase. Turn off Confirm email under Authentication → Providers → Email, then try again."
            : /invalid login credentials/i.test(error.message)
            ? "Email or password is incorrect. If you already registered, try Forgot password or check whether Supabase requires email confirmation."
            : error.message,
        );
        return;
      }
      if (!data.session) {
        setMessage("Sign-in did not create an active session. Please try again.");
        return;
      }

      const profile = await refreshProfile(
        data.session.access_token,
        data.user.user_metadata?.registration,
      );
      if (!profile) {
        setMessage(
          "Your sign-in is active, but we couldn't load your FoodBridge profile. Retry profile loading or contact support.",
        );
        return;
      }

      const requestedPath = state?.from?.pathname;
      const safeRequestedPath =
        requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
          ? requestedPath
          : null;
      navigate(safeRequestedPath ?? dashboardPath(profile), { replace: true });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We couldn't sign you in. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const retryProfile = async () => {
    setRetryingProfile(true);
    setProfileRetryError("");
    try {
      const currentProfile = await refreshProfile();
      if (!currentProfile) {
        setProfileRetryError(
          "Your profile is still unavailable. Please try again or contact support.",
        );
      }
    } catch (error) {
      setProfileRetryError(
        error instanceof Error
          ? error.message
          : "We couldn't load your profile. Please try again.",
      );
    } finally {
      setRetryingProfile(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back."
      description="Sign in to continue your work connecting surplus food with your community. Admins use this same login and are sent to the admin dashboard automatically."
    >
      {state?.message && !message ? (
        <FormMessage message={state.message} tone="info" />
      ) : null}
      {user && profile?.id !== user.id ? (
        <div className="mb-5 space-y-3">
          <FormMessage
            message={
              profileRetryError ||
              sessionNotice ||
              "Your sign-in is active, but your account profile could not be loaded."
            }
          />
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-forest px-5 text-sm font-semibold text-white disabled:opacity-60"
            disabled={retryingProfile}
            onClick={() => void retryProfile()}
            type="button"
          >
            {retryingProfile ? "Retrying profile…" : "Retry profile"}
          </button>
        </div>
      ) : null}
      {!user && sessionNotice ? (
        <div className="mb-5">
          <FormMessage message={sessionNotice} />
        </div>
      ) : null}
      <form className="space-y-5" onSubmit={submit}>
        <InputField
          autoComplete="email"
          id="login-email"
          label="Email address"
          maxLength={254}
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
        <InputField
          autoComplete="current-password"
          id="login-password"
          label="Password"
          maxLength={72}
          name="password"
          placeholder="Enter your password"
          required
          type="password"
        />
        <div className="flex justify-end">
          <Link
            className="text-sm font-semibold text-forest underline-offset-4 hover:underline"
            to="/forgot-password"
          >
            Forgot password?
          </Link>
        </div>
        {message ? <FormMessage message={message} /> : null}
        <FormSubmit disabled={Boolean(configError)} loading={loading}>
          Sign in
        </FormSubmit>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        New to FoodBridge?{" "}
        <Link
          className="font-semibold text-forest underline-offset-4 hover:underline"
          to="/register"
        >
          Create an account
        </Link>
      </p>
      <Link
        className="mt-5 block text-center text-sm text-slate-500 hover:text-forest"
        to="/"
      >
        Back to FoodBridge
      </Link>
    </AuthLayout>
  );
}
