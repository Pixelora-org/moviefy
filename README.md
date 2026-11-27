# Moviefy

A movie discovery app built with Next.js. Meme Reels is a planned feature; movie identification is not live yet.

## Features

- **Meme Reels**: A coming-soon concept for identifying movies from meme scenes and short clips
- **Pick-for-me**: Prompt-based movie discovery, with Gemini-assisted prompt interpretation when configured
- **Movie Explore**: Browse trending movies, collections, and genre-based suggestions
- **Releases Schedule**: Track upcoming movie releases
- **Personal Theatre**: Save and manage your favorite movies and playlists

## Prerequisites

You'll need API keys for the following services:

1. **TMDB** (Required): Movie database - [Get API key](https://www.themoviedb.org/settings/api)
2. **Clerk** (Required): User authentication - [Get keys](https://dashboard.clerk.com/)
3. **Supabase** (Required): Database for user data and trusted movie catalog writes - [Get keys](https://supabase.com/dashboard)
4. **Gemini** (Optional): Improves Pick-for-me prompt interpretation; a keyword fallback is available - [Get API key](https://makersuite.google.com/app/apikey)
5. **YouTube Data API** (Optional): For video reviews - [Get API key](https://console.cloud.google.com/apis/credentials)
6. **OMDb** (Optional): Additional movie ratings - [Get API key](https://www.omdbapi.com/apikey.aspx)

## Getting Started

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and add your development credentials:

```bash
cp .env.example .env.local
```

3. Prepare Supabase before running the app:

- For a new database, run `supabase/schema.sql`, then `supabase/migrate-clerk-user-ids.sql`, then `supabase/migrations/20261126_launch_hardening.sql` in the Supabase SQL Editor.
- For an existing database already migrated to Clerk string IDs, run only `supabase/migrations/20261126_launch_hardening.sql`.
- Back up production data and review migration SQL before applying it. Apply migrations in a controlled deployment step; do not make application startup run schema changes.
- Configure a Clerk JWT template named `supabase` and ensure its token subject matches the Clerk user ID used by the RLS policies. The app requests this template for Supabase access.
- Set `SUPABASE_SERVICE_ROLE_KEY` only in server-side environments. It is required for catalog writes and must never be exposed to the browser.
- The Clerk identity migration changes UUID IDs to text but does not map existing Supabase users or their data to Clerk accounts. Plan and verify any required user-data mapping separately before migrating a database with existing users.

4. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Key Features

### Meme Reels (coming soon)

Navigate to `/app/reels` for an overview of the planned feature: identify a movie from a meme scene or short clip, then open and save that title. Clip analysis and an identification feed are not implemented or available yet.

### Pick-for-me

Pick-for-me accepts a prompt and returns movie suggestions. Gemini can help interpret prompts when `GEMINI_API_KEY` is configured; otherwise, the app uses keyword matching. It does not learn a personal taste profile or send daily recommendations.

The public landing page loads TMDB popular movies at request time and caches the TMDB response for one hour. Configure `TMDB_API_KEY` in the production runtime environment so live posters are available without depending on the build environment.

## Environment Variables

See `.env.example` for all required and optional environment variables. The application requires:
- `TMDB_API_KEY`: For movie data
- Clerk keys: For authentication
- Supabase URL and anon key: For user data storage
- `SUPABASE_SERVICE_ROLE_KEY`: For the server-side movie catalog endpoint

Gemini, YouTube, and OMDb keys are optional; see `.env.example` for their specific uses.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
