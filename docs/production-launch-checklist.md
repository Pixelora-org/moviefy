# Production launch checklist

This checklist is a runbook, not evidence that production is ready. The
repository cannot verify the live Clerk, Supabase, or Vercel configuration.
Check an item only after the responsible owner has confirmed it in the relevant
dashboard or with the production smoke test.

## 1. Confirm production configuration

- [ ] In Vercel, verify the intended production project and deployment are
  selected.
- [ ] Verify these variables are present in the Vercel **Production**
  environment. Do not copy secret values into this repository, issues, or logs:
  - `TMDB_API_KEY`
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
  - `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Keep `SUPABASE_SERVICE_ROLE_KEY` server-only; never add a
  `NEXT_PUBLIC_` prefix. It is required by the trusted movie-catalog write
  endpoint.
- [ ] After any environment-variable change, redeploy and confirm the active
  production deployment uses the updated configuration.
- [ ] For Clerk on `moviefy-gules.vercel.app`, set the Clerk Dashboard
  **Domains → Frontend API → Set proxy configuration** URL to
  `https://moviefy-gules.vercel.app/__clerk`, then complete Clerk's proxy
  validation and production auth smoke test. The app passes an absolute proxy
  URL to Clerk during server rendering, using `VERCEL_PROJECT_PRODUCTION_URL`
  in production and `VERCEL_URL` for previews. `NEXT_PUBLIC_CLERK_PROXY_URL`
  may override this with an absolute URL. The app handles `/__clerk` requests
  through Clerk's built-in Next.js proxy; do not configure DNS for `vercel.app`.

## 2. Verify Supabase before applying migrations

- [ ] An authorized project owner confirms the correct production Supabase
  project is active and that its project URL matches
  `NEXT_PUBLIC_SUPABASE_URL`. If it is paused or inactive, the owner must decide
  whether and when to resume it.
- [ ] Back up production data and review the SQL before applying anything.
- [ ] Confirm which schema steps have already been applied. For a new database,
  the documented order is `supabase/schema.sql`,
  `supabase/migrate-clerk-user-ids.sql`, then
  `supabase/migrations/20261126_launch_hardening.sql`. For an existing database
  already migrated to Clerk string IDs, the launch-hardening migration is the
  remaining step. Do not rerun the initial schema against an existing database.
- [ ] **Stop before the Clerk identity migration if existing user data needs to
  be retained.** That SQL changes ID column types; it does not map existing
  Supabase UUID users or their rows to Clerk identities. An owner must decide
  and verify any mapping plan separately.
- [ ] Confirm the launch-hardening migration's effects in the production
  schema: the `movies` media-type uniqueness, the
  `consume_api_rate_limit(text)` function, and the intended RLS and grants.
  Apply a migration only through the owner's reviewed deployment process; app
  startup does not run schema changes.

## 3. Verify Clerk-to-Supabase authentication

- [ ] Confirm the production Clerk instance and its production keys are used.
- [ ] In Clerk, confirm the JWT template is named `supabase` and that the
  generated token's `sub` claim is the signed-in Clerk user ID. The Supabase
  RLS policies and rate-limit function use this claim.
- [ ] Verify the production application's Clerk sign-in/sign-up URLs and
  allowed origins match the active production hostname.
- [ ] Never paste a JWT or secret into logs, source control, or this checklist.

## 4. Run production smoke checks

Use owner-approved test accounts and a small number of normal requests; do not
load-test production as part of this checklist.

- [ ] Create a test account, sign out, and sign back in through the production
  deployment.
- [ ] With the account signed in, save a movie, reload, and confirm the saved
  item persists. If testing an uncataloged title, confirm the server-side movie
  catalog write succeeds.
- [ ] Create or update a playlist and confirm it persists after reload.
- [ ] Use a second test account to confirm it cannot see or change the first
  account's private saved movies or playlists. Confirm public playlist
  visibility separately if that feature is being launched.
- [ ] Submit one normal Pick-for-me request and confirm it returns a valid
  response with `configured: true`. If there are no matches, broaden the
  filters; do not treat a configuration or authentication error as a pass.
- [ ] Confirm the protected API endpoints reject signed-out requests and that
  signed-in requests do not return configuration or Supabase-authentication
  errors.
- [ ] Verify request throttling with test accounts in a non-production
  environment. The current database function allows 10 Pick-for-me requests
  and 30 movie-catalog requests per user per minute; do not deliberately reach
  these limits in production.
- [ ] Check the Vercel and Supabase logs for errors from the smoke test, without
  exposing credentials or tokens.

## 5. Owner decisions before a public launch

- [ ] The product owner (and legal counsel where appropriate) approves the
  privacy notice, terms, data-retention policy, account-deletion process, and
  moderation/reporting policy. This repository does not establish those
  policies or their required retention periods.
- [ ] Decide whether to launch on the current Vercel hostname or configure a
  custom domain. A custom domain is optional and is not assumed by this
  checklist.
- [ ] The release owner records that the production checks above passed before
  directing users to the deployment.

## Repository checks

Run the same checks used by the repository CI:

```bash
npm run lint:launch
npm run typecheck
npm test
npm run build
```

These checks do not replace the live-service and owner confirmations above.
