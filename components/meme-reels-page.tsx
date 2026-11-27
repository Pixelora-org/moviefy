import Link from "next/link";
import { ArrowLeft, Clapperboard, Compass, Film } from "lucide-react";
import { AppUserButton } from "@/components/app-user-button";
import { MobileAppNavSheet } from "@/components/mobile-app-nav-sheet";
import { MemeReelsSection } from "@/components/meme-reels-section";
export function MemeReelsPage() {
  return (
    <div className="min-h-dvh text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/45 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/35">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-3 py-3 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <MobileAppNavSheet />
            <Link
              href="/app/explore"
              aria-label="Back to Explore"
              className="hidden min-h-10 shrink-0 items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-foreground/90 transition hover:bg-muted/50 lg:flex"
            >
              <ArrowLeft className="size-4 shrink-0" />
              Explore
            </Link>
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-200">
                <Film className="size-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="type-kicker">Meme reels</p>
                <p className="type-micro truncate">Movie identification is in development</p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div className="hidden items-center gap-2 lg:flex">
              <Link
                href="/app"
                className="inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
              >
                <Clapperboard className="size-4 shrink-0" />
                Your theatre
              </Link>
              <Link
                href="/app/explore"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
              >
                <Compass className="size-4 shrink-0" />
                Explore
              </Link>
            </div>
            <AppUserButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-3 py-6 pb-[max(2rem,calc(1.25rem+env(safe-area-inset-bottom)))] sm:px-5 sm:py-10">
        <MemeReelsSection sectionId="reels-page-root" />
      </main>
    </div>
  );
}
