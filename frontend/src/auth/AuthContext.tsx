import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { requestJson } from "../services/apiClient";
import { ensureRegistrationProfiles } from "../services/registrationProfiles";
import { getSupabaseClient } from "../services/supabaseClient";
import type {
  AuthContextValue,
  AuthProfile,
  AuthProfileResponse,
} from "../types/auth";

const AuthContext = createContext<AuthContextValue | null>(null);

async function withTimeout<T>(operation: PromiseLike<T>, message: string): Promise<T> {
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(message)), 10_000);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const loadProfile = useCallback(async (accessToken: string) => {
    const response = await withTimeout(
      requestJson<AuthProfileResponse>("/auth/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      "The account service did not respond. Check that the backend is running, then try again.",
    );
    return response.profile;
  }, []);

  const refreshProfile = useCallback(
    async (accessToken?: string, registration?: unknown) => {
      const supabase = getSupabaseClient();
      let token = accessToken;
      let registrationMetadata = registration;
      let authenticatedUser: User | undefined;
      if (!token || registrationMetadata) {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!token) token = data.session?.access_token;
        authenticatedUser = data.session?.user;
        registrationMetadata ??= authenticatedUser?.user_metadata?.registration;
      }
      if (!token) {
        setProfile(null);
        return null;
      }
      try {
        if (registrationMetadata && authenticatedUser) {
          await ensureRegistrationProfiles(authenticatedUser, registrationMetadata);
        }
        const currentProfile = await loadProfile(token);
        setProfile(currentProfile);
        setSessionNotice(
          currentProfile
            ? null
            : "Your account profile is not available yet. Retry profile setup or contact support.",
        );
        return currentProfile;
      } catch (error) {
        setProfile(null);
        setSessionNotice(
          error instanceof Error
            ? error.message
            : "We couldn't verify your account profile.",
        );
        throw error;
      }
    },
    [loadProfile],
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
    setSessionNotice(null);
  }, []);

  useEffect(() => {
    let active = true;
    let generation = 0;
    let latestSessionToken: string | null | undefined;
    let supabase: ReturnType<typeof getSupabaseClient>;
    try {
      supabase = getSupabaseClient();
    } catch (error) {
      setConfigError(
        error instanceof Error ? error.message : "Supabase is not configured.",
      );
      setReady(true);
      return;
    }

    const syncSession = async (session: Session | null) => {
      const sessionToken = session?.access_token ?? null;
      if (sessionToken === latestSessionToken) return;
      latestSessionToken = sessionToken;
      const currentGeneration = ++generation;
      if (!session) {
        if (!active || currentGeneration !== generation) return;
        setUser(null);
        setProfile(null);
        setSessionNotice(null);
        setReady(true);
        return;
      }

      setReady(false);
      setUser(session.user);
      setProfile(null);
      setSessionNotice(null);
      try {
        await ensureRegistrationProfiles(
          session.user,
          session.user.user_metadata?.registration,
        );
        const currentProfile = await loadProfile(session.access_token);
        if (!active || currentGeneration !== generation) return;
        setProfile(currentProfile);
        if (!currentProfile) {
          setSessionNotice(
            "Your account profile is not available yet. Retry profile setup or contact support.",
          );
        }
      } catch (error) {
        if (!active || currentGeneration !== generation) return;
        setProfile(null);
        setSessionNotice(
          error instanceof Error
            ? error.message
            : "We couldn't verify your account profile.",
        );
      } finally {
        if (active && currentGeneration === generation) setReady(true);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      window.setTimeout(() => void syncSession(session), 0);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || latestSessionToken !== undefined) return;
      if (error) {
        setSessionNotice(error.message);
        setReady(true);
        return;
      }
      void syncSession(data.session);
    }).catch((error: unknown) => {
      if (!active || latestSessionToken !== undefined) return;
      setSessionNotice(
        error instanceof Error
          ? error.message
          : "Your saved session could not be restored. Please try again.",
      );
      setReady(true);
    });

    return () => {
      active = false;
      generation += 1;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      user,
      profile,
      configError,
      sessionNotice,
      refreshProfile,
      signOut,
    }),
    [
      ready,
      user,
      profile,
      configError,
      sessionNotice,
      refreshProfile,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}
