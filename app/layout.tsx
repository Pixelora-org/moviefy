import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import localFont from "next/font/local";
import { ClerkAppShell } from "@/components/clerk-app-shell";
import { SupabaseAppProvider } from "@/components/supabase-app-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

/** UI body — neutral, readable. */
const sans = localFont({
  src: "./fonts/inter-latin.woff2",
  variable: "--font-body",
  display: "swap",
  weight: "400 800",
});

const mono = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  variable: "--font-mono",
  display: "swap",
  weight: "400 600",
});

/** Display / titles — bold condensed marquee energy. */
const heading = localFont({
  src: "./fonts/archivo-latin.woff2",
  variable: "--font-display",
  display: "swap",
  weight: "600 900",
});

export const metadata: Metadata = {
  title: "Moviefy — movie lists, ranked",
  description:
    "Build playlists of films, rank them, explore genres, and share or keep lists private — Spotify-style energy for movies.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
  ],
};

const configuredClerkProxyUrl = process.env.NEXT_PUBLIC_CLERK_PROXY_URL?.trim();
const vercelHostname =
  process.env.VERCEL_ENV === "production"
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
    : process.env.VERCEL_URL;
const clerkProxyUrl =
  configuredClerkProxyUrl ||
  (vercelHostname ? `https://${vercelHostname}/__clerk/` : undefined);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${sans.variable} ${mono.variable} ${heading.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="app-body-skin app-touch-root flex min-h-dvh flex-col text-foreground">
        <ClerkAppShell proxyUrl={clerkProxyUrl}>
          <SupabaseAppProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </SupabaseAppProvider>
        </ClerkAppShell>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
