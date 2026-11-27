import { PosterImage } from "@/components/poster-image";
import Link from "next/link";
import {
  ArrowRight,
  Clapperboard,
  Compass,
  Heart,
  ListMusic,
  Play,
  Zap,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  buildLandingPosterWall,
  getLandingMovies,
  landingDecorMovies,
  landingHeroFocus,
} from "@/lib/landing-movies";
import type { Movie } from "@/lib/types";
import { cn } from "@/lib/utils";

const LANDING_NEXT = "/app/explore";
const landingSignInHref = `/sign-in?redirect_url=${encodeURIComponent(LANDING_NEXT)}`;
const landingSignUpHref = `/sign-up?redirect_url=${encodeURIComponent(LANDING_NEXT)}`;
const POSITIONING_STATEMENT =
  "Browse movies, explore a mood, and keep the picks you want to watch.";

function PosterTile({
  movie,
  className,
  sizes,
  priority,
}: {
  movie: Movie;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-white/10 transition duration-500 hover:z-10 hover:ring-primary/40 hover:shadow-[0_0_32px_-4px_rgba(0,0,0,0.8)]",
        className,
      )}
    >
      <PosterImage
        src={movie.posterImage}
        alt={movie.title || ""}
        fill
        priority={priority}
        placeholderGradient={movie.posterClass}
        className="object-cover transition duration-700 group-hover:scale-110"
        sizes={sizes}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
      {movie.title.trim() ? (
        <p className="pointer-events-none absolute bottom-1.5 left-2 right-2 translate-y-2 text-[10px] font-medium leading-tight text-white opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 sm:text-xs">
          {movie.title}
        </p>
      ) : null}
    </div>
  );
}

export default async function Home() {
  const popular = await getLandingMovies();
  const posterWall = popular.length
    ? buildLandingPosterWall(popular)
    : landingDecorMovies(28);
  const heroFocus =
    popular.length >= 6
      ? landingHeroFocus(popular)
      : popular.length > 0
        ? [...popular, ...landingDecorMovies(6 - popular.length)]
        : landingDecorMovies(6);
  const marqueeSource = popular.length ? popular : landingDecorMovies(12);
  const marqueeMovies = [...marqueeSource, ...marqueeSource, ...marqueeSource];
  const shelfMovies = popular.length ? popular : landingDecorMovies(10);
  const mobileStrip = popular.length ? popular : landingDecorMovies(8);

  return (
    <main className="relative min-h-dvh overflow-x-hidden text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.76_0.17_151_/_0.18),transparent)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_50%,oklch(0.55_0.2_300_/_0.08),transparent)]" />

      <div className="relative mx-auto max-w-[1400px] px-4 pb-[max(6rem,calc(4.5rem+env(safe-area-inset-bottom)))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 lg:px-10">
        <header className="sticky top-[max(0.75rem,env(safe-area-inset-top))] z-50 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-zinc-950/70 px-4 py-3 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:top-4 sm:mb-8 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/30 to-primary/5 text-primary ring-1 ring-primary/25">
              <Clapperboard className="size-5" />
            </div>
            <div>
              <span className="font-heading text-lg font-semibold tracking-tight">Moviefy</span>
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Films · Playlists · Vibe</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href={landingSignInHref}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "hidden min-h-10 gap-1.5 text-zinc-300 sm:inline-flex",
              )}
            >
              <Compass className="size-4" />
              Explore
            </Link>
            <Link
              href={landingSignInHref}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "min-h-10")}
            >
              Sign in
            </Link>
            <Link
              href={landingSignUpHref}
              className={cn(buttonVariants({ size: "sm" }), "min-h-10")}
            >
              Sign up
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.07] bg-zinc-950/40 shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset]">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute -left-[8%] -top-[10%] grid w-[116%] grid-cols-6 gap-1.5 opacity-[0.35] sm:grid-cols-8 sm:gap-2 md:opacity-45"
              style={{ transform: "rotate(-3deg) scale(1.05)" }}
            >
              {posterWall.map((m, i) => (
                <div key={`wall-${m.id}-${i}`} className="relative aspect-[2/3] min-h-0">
                  <PosterImage
                    src={m.posterImage}
                    alt=""
                    fill
                    placeholderGradient={m.posterClass}
                    className="object-cover saturate-[0.85]"
                    sizes="80px"
                  />
                </div>
              ))}
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-[#060607] via-[#060607]/88 to-[#060607]" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#060607] via-transparent to-[#060607]/90" />
          </div>

          <div className="relative grid gap-12 px-6 py-14 sm:px-10 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-8 lg:py-20">
            <div className="max-w-xl lg:max-w-none">
              <p className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/90">
                Movie discovery, without endless scrolling.
              </p>
              <h1 className="mt-4 font-heading text-[2.35rem] font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.25rem] xl:text-[3.5rem]">
                Find a movie
                <br />
                for <span className="landing-text-shimmer">your mood</span>
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-zinc-400 sm:text-lg">
                {POSITIONING_STATEMENT} Pick for me turns a prompt into movie suggestions;
                it doesn&apos;t learn a taste profile or send daily recommendations.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={landingSignInHref}
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "h-12 gap-2 px-7 shadow-[0_0_40px_-8px_var(--color-primary)]",
                  )}
                >
                  <Play className="size-4 fill-current" />
                  Pick for me
                </Link>
                <Link
                  href={landingSignInHref}
                  className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-12 border-white/15 bg-white/5")}
                >
                  <Compass className="size-4" />
                  Explore movies
                </Link>
              </div>
            </div>

            {/* Floating poster cluster */}
            <div className="relative mx-auto hidden w-full max-w-[420px] lg:mx-0 lg:block">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 via-transparent to-fuchsia-500/10 blur-2xl" />
              <div className="relative flex flex-col gap-3 p-2">
                <div className="flex items-end justify-center gap-3">
                  <PosterTile
                    movie={heroFocus[0]!}
                    className="aspect-[2/3] w-[46%] max-w-[200px] rounded-2xl"
                    sizes="200px"
                    priority
                  />
                  <PosterTile
                    movie={heroFocus[1]!}
                    className="aspect-[2/3] w-[34%] max-w-[150px] -translate-y-5 rounded-xl"
                    sizes="160px"
                    priority
                  />
                </div>
                <div className="flex justify-center gap-2 pr-6">
                  <PosterTile
                    movie={heroFocus[2]!}
                    className="aspect-[2/3] w-[28%] max-w-[110px] rounded-lg"
                    sizes="120px"
                    priority
                  />
                  <PosterTile
                    movie={heroFocus[3]!}
                    className="aspect-[2/3] w-[40%] max-w-[170px] rounded-xl"
                    sizes="180px"
                  />
                  <PosterTile
                    movie={heroFocus[4]!}
                    className="aspect-[2/3] w-[26%] max-w-[105px] -translate-y-2 rounded-lg"
                    sizes="110px"
                  />
                </div>
                <div className="flex justify-center">
                  <PosterTile
                    movie={heroFocus[5]!}
                    className="aspect-[2/3] w-[36%] max-w-[150px] rounded-xl"
                    sizes="140px"
                  />
                </div>
              </div>
            </div>

            {/* Mobile poster strip */}
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
              {mobileStrip.map((m) => (
                <div
                  key={`mob-${m.id}`}
                  className="relative aspect-[2/3] w-[100px] shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10"
                >
                  <PosterImage
                    src={m.posterImage}
                    alt={m.title || ""}
                    fill
                    placeholderGradient={m.posterClass}
                    className="object-cover"
                    sizes="100px"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Marquee */}
        <section className="relative mt-10 -mx-4 overflow-hidden border-y border-white/[0.06] bg-zinc-950/50 py-5 sm:-mx-6 lg:-mx-10">
          <p className="mb-3 px-6 text-center text-[10px] font-semibold uppercase tracking-[0.35em] text-zinc-500">
            {popular.length ? "Now trending on shelves" : "Poster moodboard"}
          </p>
          <div className="overflow-hidden">
            <div className="landing-marquee-track gap-3 pr-3">
              {marqueeMovies.map((m, i) => (
                <div
                  key={`mq-${m.id}-${i}`}
                  className="relative aspect-[2/3] w-[72px] shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10 sm:w-[88px]"
                >
                  <PosterImage
                    src={m.posterImage}
                    alt=""
                    fill
                    placeholderGradient={m.posterClass}
                    className="object-cover"
                    sizes="90px"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mt-16">
          <div className="mb-10 text-center sm:text-left">
            <h2 className="font-heading text-3xl font-semibold sm:text-4xl">No more endless scrolling</h2>
            <p className="mt-2 max-w-2xl text-zinc-400">
              Explore available titles, find options for a mood, and save what you want to watch.
            </p>
          </div>
          <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-zinc-950/45 px-5 py-6 sm:px-8 sm:py-8">
            <div className="pointer-events-none absolute inset-0 opacity-[0.3]">
              <div className="landing-marquee-track gap-2 pr-2">
                {marqueeMovies.map((m, i) => (
                  <div
                    key={`flow-${m.id}-${i}`}
                    className="relative aspect-[2/3] w-[56px] shrink-0 overflow-hidden rounded-md ring-1 ring-white/10 sm:w-[64px]"
                  >
                    <PosterImage
                      src={m.posterImage}
                      alt=""
                      fill
                      placeholderGradient={m.posterClass}
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-[#060607] via-[#060607]/72 to-[#060607]" />
            </div>

            <div className="relative grid gap-5 md:grid-cols-3">
              <article className="rounded-2xl border border-white/10 bg-black/35 p-5 backdrop-blur-sm">
                <Compass className="size-9 rounded-lg bg-sky-500/15 p-2 text-sky-400" />
                <h3 className="mt-4 font-heading text-xl font-semibold">1. Pick a mood or prompt</h3>
                <p className="mt-2 text-sm text-zinc-300">
                  Choose genres and filters, or describe the kind of movie you are looking for.
                </p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-black/35 p-5 backdrop-blur-sm">
                <Zap className="size-9 rounded-lg bg-amber-500/15 p-2 text-amber-400" />
                <h3 className="mt-4 font-heading text-xl font-semibold">2. Explore suggestions</h3>
                <p className="mt-2 text-sm text-zinc-300">
                  Pick for me interprets your prompt and finds matching movies to browse.
                </p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-black/35 p-5 backdrop-blur-sm">
                <ListMusic className="size-9 rounded-lg bg-primary/15 p-2 text-primary" />
                <h3 className="mt-4 font-heading text-xl font-semibold">3. Save your winners</h3>
                <p className="mt-2 text-sm text-zinc-300">
                  Save movies to your theatre and organize them in playlists.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* Horizontal shelf */}
        <section className="mt-16">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-semibold sm:text-3xl">Proof in posters</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {popular.length
                  ? ""
                  : "Gradient placeholders until TMDB_API_KEY is set — then real posters load here."}
              </p>
            </div>
            <Link
              href={landingSignInHref}
              className="hidden shrink-0 text-sm font-medium text-primary hover:underline sm:inline"
            >
              See all in app →
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory [&::-webkit-scrollbar]:hidden">
            {shelfMovies.map((m) => (
              <div key={`shelf-${m.id}`} className="snap-start">
                <PosterTile
                  movie={m}
                  className="aspect-[2/3] w-[140px] shrink-0 rounded-2xl sm:w-[168px]"
                  sizes="168px"
                />
                {m.title.trim() ? (
                  <>
                    <p className="mt-2 max-w-[168px] text-xs font-medium text-zinc-300 line-clamp-1">{m.title}</p>
                    <p className="text-[11px] text-zinc-500">
                      {m.year} · {m.genre}
                    </p>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="relative mt-20 overflow-hidden rounded-[2rem] border border-primary/25 bg-gradient-to-br from-primary/15 via-zinc-950 to-zinc-950 px-6 py-14 text-center sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -left-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 bottom-0 h-48 w-48 rounded-full bg-fuchsia-500/15 blur-3xl" />
          <h2 className="relative font-heading text-3xl font-semibold sm:text-4xl md:text-5xl">
            Find a movie for your mood.
            <br />
            <span className="text-primary">No endless scrolling.</span>
          </h2>
          <p className="relative mx-auto mt-4 max-w-lg text-zinc-400">
            {POSITIONING_STATEMENT}
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={landingSignInHref}
              className={cn(buttonVariants({ size: "lg" }), "h-12 px-8")}
            >
              Pick for me
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href={landingSignInHref}
              className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-12 border-white/20 bg-black/20")}
            >
              Explore movies
            </Link>
          </div>
        </section>
      </div>

    </main>
  );
}
