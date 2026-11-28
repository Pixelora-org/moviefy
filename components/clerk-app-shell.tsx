"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { clerkMoviefyAuthAppearance } from "@/lib/clerk/movie-auth-appearance";

const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

/**
 * Wraps the app with Clerk when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set.
 * Also set `CLERK_SECRET_KEY` in the server env so middleware can verify sessions.
 */
export function ClerkAppShell({
  children,
  proxyUrl,
}: {
  children: ReactNode;
  proxyUrl?: string;
}) {
  if (!pk) return children;

  return (
    <ClerkProvider
      publishableKey={pk}
      proxyUrl={proxyUrl}
      afterSignOutUrl="/"
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      appearance={{
        cssLayerName: "clerk",
        ...clerkMoviefyAuthAppearance,
      }}
    >
      {children}
    </ClerkProvider>
  );
}
