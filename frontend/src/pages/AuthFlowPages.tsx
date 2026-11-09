import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  AuthLayout,
  FormMessage,
  FormSubmit,
} from "../components/auth/AuthLayout";
import { InputField } from "../components/ui";
import { getSupabaseClient } from "../services/supabaseClient";
import { ensureRegistrationProfiles } from "../services/registrationProfiles";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const { error } = await getSupabaseClient().auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/reset-password` },
      );
      if (error) throw error;
      setMessage(
        "If an account exists for that address, password reset instructions will arrive shortly.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We couldn't send reset instructions. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Account recovery"
      title="Reset your password."
      description="Enter the email address associated with your account. We’ll send instructions if it’s registered."
    >
      <form className="space-y-5" onSubmit={submit}>
        <InputField
          autoComplete="email"
          id="forgot-email"
          label="Email address"
          maxLength={254}
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
        {message ? (
          <FormMessage
            message={message}
            tone={message.startsWith("If an account") ? "success" : "error"}
          />
        ) : null}
        <FormSubmit loading={loading}>Send reset link</FormSubmit>
      </form>
      <Link
        className="mt-6 block text-center text-sm font-semibold text-forest hover:underline"
        to="/login"
      >
        Back to sign in
      </Link>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const { ready, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirm_password") ?? "");
    if (password.length < 10 || password.length > 72) {
      setMessage("Use a password between 10 and 72 characters.");
      return;
    }
    if (password !== confirmation) {
      setMessage("The passwords do not match.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const { error } = await getSupabaseClient().auth.updateUser({ password });
      if (error) throw error;
      await signOut();
      navigate("/login", {
        replace: true,
        state: { message: "Your password was updated. Sign in with the new password." },
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "This reset link may have expired. Request a new one and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (ready && !user) {
    return (
      <AuthLayout
        eyebrow="Account recovery"
        title="This reset link has expired."
        description="Request a fresh password reset link and open it from the same browser."
      >
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-forest px-5 text-sm font-semibold text-white"
          to="/forgot-password"
        >
          Request another reset link
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Account recovery"
      title="Choose a new password."
      description="Use a strong password that you don't use for other accounts."
    >
      {!ready ? (
        <p className="text-sm text-slate-500">Checking your reset session…</p>
      ) : (
        <form className="space-y-5" onSubmit={submit}>
          <InputField
            autoComplete="new-password"
            id="reset-password"
            label="New password"
            maxLength={72}
            minLength={10}
            name="password"
            placeholder="At least 10 characters"
            required
            type="password"
          />
          <InputField
            autoComplete="new-password"
            id="reset-password-confirm"
            label="Confirm new password"
            maxLength={72}
            minLength={10}
            name="confirm_password"
            placeholder="Enter your password again"
            required
            type="password"
          />
          {message ? <FormMessage message={message} /> : null}
          <FormSubmit loading={loading}>Update password</FormSubmit>
        </form>
      )}
    </AuthLayout>
  );
}

export function AuthCallbackPage() {
  const { ready, user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const started = useRef(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!ready || !user || started.current) return;
    started.current = true;

    const registration = user.user_metadata?.registration;
    if (!registration) {
      navigate("/login", {
        replace: true,
        state: { message: "Your account is ready. You can now sign in." },
      });
      return;
    }

    void (async () => {
      try {
        const { data } = await getSupabaseClient().auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) {
          throw new Error("Your setup session expired. Please sign in.");
        }
        await ensureRegistrationProfiles(user, registration);
        await refreshProfile(accessToken);
        navigate("/dashboard", { replace: true });
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "We couldn't finish registration. Please sign in and try again.",
        );
      }
    })();
  }, [ready, user, refreshProfile, navigate]);

  if (!ready) {
    return (
      <AuthLayout
        eyebrow="Account setup"
        title="Finishing your setup."
        description="Please wait while we prepare your account."
      >
        <p className="text-sm text-slate-500">This should only take a moment…</p>
      </AuthLayout>
    );
  }

  if (!user || message) {
    const queryMessage = new URLSearchParams(location.search).get("error_description");
    return (
      <AuthLayout
        eyebrow="Account setup"
        title="We couldn't finish setup."
        description={
          queryMessage ??
          (message || "Sign in again or create a new account.")
        }
      >
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-forest px-5 text-sm font-semibold text-white"
            to="/register"
          >
            Create an account
          </Link>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-forest/20 px-5 text-sm font-semibold text-forest"
            to="/login"
          >
            Sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Account setup"
      title="Finishing your setup."
      description="We’re preparing your account profile."
    >
      <p className="text-sm text-slate-500">Please keep this page open…</p>
    </AuthLayout>
  );
}
