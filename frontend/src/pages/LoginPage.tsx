import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AuthLayout, FormMessage, FormSubmit } from "../components/auth/AuthLayout";
import { InputField } from "../components/ui";
import { requestJson } from "../services/apiClient";
import { getSupabaseClient } from "../services/supabaseClient";
import { dashboardPath } from "../auth/routeGuards";

interface LoginLocationState {
  from?: { pathname?: string };
  message?: string;
}

export function LoginPage() {
  const { user, ready, configError, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LoginLocationState | null;
  const [message, setMessage] = useState(state?.message ?? "");
  const [loading, setLoading] = useState(false);

  if (ready && user) {
    return <Navigate replace to="/dashboard" />;
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
              ? "Email or password is incorrect."
            : error.message,
        );
        return;
      }
      if (!data.session) {
        setMessage("Sign-in did not create an active session. Please try again.");
        return;
      }

      const profile = await refreshProfile(data.session.access_token);
      if (!profile) {
        const registration = data.user.user_metadata?.registration;
        if (registration) {
          await requestJson("/auth/complete-registration", {
            method: "POST",
            headers: { Authorization: "Bearer " + data.session.access_token },
          });
          const completedProfile = await refreshProfile(data.session.access_token);
          if (completedProfile) {
            navigate(dashboardPath(completedProfile), { replace: true });
            return;
          }
        }
        await getSupabaseClient().auth.signOut();
        setMessage("Your account profile is not set up. Please register again or contact support.");
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

  return (
    <AuthLayout
      title="Welcome back."
      description="Sign in to continue your work connecting surplus food with your community."
    >
      {state?.message && !message ? (
        <FormMessage message={state.message} tone="info" />
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
