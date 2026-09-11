# Moviefy

A Spotify-style movie discovery app built with Next.js, featuring AI-powered movie identification from meme reels.

## Features

- **Meme Reels**: AI-powered movie identification from YouTube meme videos using Gemini LLM
- **Pick-for-me**: AI-assisted movie discovery with natural language prompts
- **Movie Explore**: Browse trending movies, curated collections, and personalized recommendations
- **Releases Schedule**: Track upcoming movie releases
- **Personal Theatre**: Save and manage your favorite movies and playlists

## Prerequisites

You'll need API keys for the following services:

1. **TMDB** (Required): Movie database - [Get API key](https://www.themoviedb.org/settings/api)
2. **Gemini** (Required for AI features): Google's LLM - [Get API key](https://makersuite.google.com/app/apikey)
3. **YouTube Data API** (Optional): For video reviews - [Get API key](https://console.cloud.google.com/apis/credentials)
4. **OMDb** (Optional): Additional movie ratings - [Get API key](https://www.omdbapi.com/apikey.aspx)
5. **Clerk** (Required): User authentication - [Get keys](https://dashboard.clerk.com/)
6. **Supabase** (Required): Database for user data - [Get keys](https://supabase.com/dashboard)

## Getting Started

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and add your API keys:

```bash
cp .env.example .env.local
```

3. Run the development server:

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

### Meme Reels

Navigate to `/app/reels` to see AI-powered movie identification from meme videos. The feature:
- Uses Gemini LLM to identify movies from video titles, channel names, and meme tags
- Resolves movie titles to TMDB movie data
- Displays identified movies with direct links to movie details
- Gracefully degrades when API keys are missing

### Pick-for-me

An AI-powered movie recommendation system that uses Gemini to interpret natural language queries like "funny sci-fi from the 90s" and suggests movies based on your preferences.

## Environment Variables

See `.env.example` for all required and optional environment variables. At minimum, you need:
- `TMDB_API_KEY`: For movie data
- `GEMINI_API_KEY`: For AI-powered features
- Clerk keys: For authentication
- Supabase keys: For user data storage

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
