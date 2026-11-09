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
import { ApiError, requestJson } from "../services/apiClient";
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
    setProfile(response.profile);
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
      if (registrationMetadata && authenticatedUser) {
        await ensureRegistrationProfiles(authenticatedUser, registrationMetadata);
      }
      const currentProfile = await loadProfile(token);
      if (currentProfile) setSessionNotice(null);
      return currentProfile;
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
      const currentGeneration = ++generation;
      if (!session) {
        if (!active || currentGeneration !== generation) return;
        setUser(null);
        setProfile(null);
        setReady(true);
        return;
      }

      try {
        const { data, error } = await withTimeout(
          supabase.auth.getUser(session.access_token),
          "Supabase did not respond while checking your session. Check your connection and Supabase configuration, then sign in again.",
        );
        if (!active || currentGeneration !== generation) return;
        if (error || !data.user) {
          setUser(null);
          setProfile(null);
          setSessionNotice("Your session expired. Please sign in again.");
          await supabase.auth.signOut();
          setReady(true);
          return;
        }

        setUser(data.user);
        setSessionNotice(null);
        try {
          await ensureRegistrationProfiles(
            data.user,
            data.user.user_metadata?.registration,
          );
          const currentProfile = await loadProfile(session.access_token);
          if (!currentProfile) {
            setSessionNotice("Your account profile is not set up. Retry profile setup or contact support.");
          }
        } catch (profileError) {
          if (!active || currentGeneration !== generation) return;
          if (profileError instanceof ApiError && profileError.status === 401) {
            setUser(null);
            setProfile(null);
            setSessionNotice("Your session expired. Please sign in again.");
            await supabase.auth.signOut();
          } else if (
            profileError instanceof ApiError &&
            profileError.status === 403
          ) {
            setProfile(null);
            setSessionNotice(profileError.message);
          } else {
            setProfile(null);
            setSessionNotice(
              profileError instanceof Error
                ? profileError.message
                : "We couldn't verify your account profile.",
            );
          }
        }
      } catch (error) {
        if (!active || currentGeneration !== generation) return;
        setUser(null);
        setProfile(null);
        setSessionNotice(
          error instanceof Error
            ? error.message
            : "Your session could not be verified. Please sign in again.",
        );
        await supabase.auth.signOut();
      } finally {
        if (active && currentGeneration === generation) setReady(true);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => void syncSession(session), 0);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setSessionNotice(error.message);
        setReady(true);
        return;
      }
      void syncSession(data.session);
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
