"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { isClerkConfigured } from "@/lib/clerk/auth-mode";
import { mapClerkUserToAppUser, type AppUser } from "@/lib/app-user";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser-client";
import { getSupabaseBrowserConfig } from "@/lib/supabase/config";

export type { AppUser };

type Ctx = {
  client: SupabaseClient | null;
  appUser: AppUser | null;
  /** Clerk user ID used by the database's RLS policies and text user IDs. */
  dbUserId: string | null;
  ready: boolean;
  authError: string | null;
};

const SupabaseAppContext = createContext<Ctx | null>(null);

export function useSupabaseApp(): Ctx {
  const c = useContext(SupabaseAppContext);
  if (!c) {
    throw new Error("useSupabaseApp must be used within SupabaseAppProvider");
  }
  return c;
}

function AnonSupabaseProvider({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => createBrowserSupabaseClient(), []);
  const value = useMemo(
    () =>
      ({
        client,
        appUser: null,
        dbUserId: null,
        ready: true,
        authError: null,
      }) satisfies Ctx,
    [client],
  );
  return (
    <SupabaseAppContext.Provider value={value}>
      {children}
    </SupabaseAppContext.Provider>
  );
}

function ClerkSupabaseProvider({ children }: { children: React.ReactNode }) {
  const cfg = useMemo(() => getSupabaseBrowserConfig(), []);
  const { isLoaded, userId, getToken } = useAuth();
  const { user } = useUser();

  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [dbUserId, setDbUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const appUser = useMemo(() => {
    const base = mapClerkUserToAppUser(user ?? undefined);
    if (!base) return null;
    return { ...base, id: dbUserId ?? base.id };
  }, [user, dbUserId]);

  useEffect(() => {
    if (!cfg) {
      setClient(null);
      setDbUserId(null);
      setAuthError(null);
      setReady(true);
      return;
    }

    if (!isLoaded) {
      return;
    }

    let cancelled = false;
    setReady(false);

    (async () => {
      try {
        const token = await getToken();
        if (cancelled) return;
        if (userId && !token) {
          throw new Error("No Clerk session token available for Supabase.");
        }
        const c = createClient(cfg.url, cfg.anonKey, {
          accessToken: async () => (await getToken()) ?? null,
        });
        setClient(c);
        const clerkId =
          typeof userId === "string" && userId.trim() ? userId : null;
        setDbUserId(clerkId);
        setAuthError(
          clerkId
            ? null
            : "No identity available from Clerk session. Please sign out/in.",
        );
      } catch (e) {
        if (!cancelled) {
          setAuthError(e instanceof Error ? e.message : "Supabase client error");
          setDbUserId(null);
          setClient(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cfg, isLoaded, userId, getToken]);

  const value = useMemo(
    () => ({ client, appUser, dbUserId, ready, authError }),
    [client, appUser, dbUserId, ready, authError],
  );

  return (
    <SupabaseAppContext.Provider value={value}>
      {children}
    </SupabaseAppContext.Provider>
  );
}

export function SupabaseAppProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isClerkConfigured()) {
    return <AnonSupabaseProvider>{children}</AnonSupabaseProvider>;
  }
  return <ClerkSupabaseProvider>{children}</ClerkSupabaseProvider>;
}
