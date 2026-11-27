import Link from "next/link";
import {
  ArrowRight,
  BookmarkPlus,
  Clapperboard,
  Film,
  Search,
  Sparkles,
} from "lucide-react";
import { MoviefyTeaseMark } from "@/components/moviefy-brand-loader";
import { Badge } from "@/components/ui/badge";

export type MemeReelsSectionProps = {
  sectionId?: string;
};

const STEPS = [
  {
    icon: Film,
    title: "Bring a reel",
    description: "Start with a memorable movie scene hiding in a meme or short clip.",
  },
  {
    icon: Search,
    title: "Find the film",
    description: "Moviefy will identify the likely movie and take you to its details.",
  },
  {
    icon: BookmarkPlus,
    title: "Keep the discovery",
    description: "Save the title for later or follow the scene into similar picks.",
  },
];

export function MemeReelsSection({
  sectionId = "reels-page-root",
}: MemeReelsSectionProps) {
  return (
    <section id={sectionId} className="scroll-mt-28">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/25 to-amber-500/20 text-amber-200 ring-1 ring-white/10">
            <Film className="size-5" aria-hidden />
          </div>
          <div>
            <h2 className="type-section-title">Meme reels</h2>
            <p className="type-section-sub mt-0 max-w-2xl">
              Spot a scene. Find the movie. Keep the discovery.
            </p>
          </div>
        </div>
        <Badge className="shrink-0 border-0 bg-amber-500/15 text-amber-100">
          <Sparkles className="mr-1 size-3" aria-hidden />
          In the edit bay
        </Badge>
      </div>

      <div className="app-panel relative isolate overflow-hidden border-amber-500/20 bg-gradient-to-br from-amber-500/[0.08] via-card to-rose-500/[0.07] p-0">
        <div
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-70"
          aria-hidden
        >
          <div className="absolute -left-20 top-1/2 size-60 -translate-y-1/2 rounded-full bg-rose-500/15 blur-3xl" />
          <div className="absolute -right-14 -top-20 size-56 rounded-full bg-amber-400/15 blur-3xl" />
        </div>

        <div className="grid gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)] lg:items-center lg:gap-10">
          <div className="max-w-2xl">
            <div className="mb-6 flex items-center gap-3">
              <MoviefyTeaseMark />
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/80">
                A new kind of movie hunt
              </span>
            </div>
            <h3 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              That meme scene has a movie behind it.
            </h3>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              We&apos;re building a way to identify films from memorable meme
              reels and short clips. When it&apos;s ready, you&apos;ll be able to
              go from a familiar scene to the movie&apos;s details and save it
              for later. The identification feed isn&apos;t live yet.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/app/explore"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
              >
                Explore movies
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/app"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border/70 bg-background/35 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-background/65"
              >
                <Clapperboard className="size-4" aria-hidden />
                Your theatre
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {STEPS.map(({ icon: Icon, title, description }, index) => (
              <article
                key={title}
                className="flex gap-3 rounded-2xl border border-white/[0.08] bg-background/35 p-4 backdrop-blur-sm"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-100">
                  <Icon className="size-4" aria-hidden />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    <span className="mr-1.5 text-xs text-amber-200/75">
                      0{index + 1}
                    </span>
                    {title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="border-t border-border/50 bg-background/20 px-5 py-3 text-center text-xs text-muted-foreground sm:px-8">
          Still in development — no clips are being analyzed yet.
        </div>
      </div>
    </section>
  );
}
