-- Moviefy — run this in Supabase SQL Editor (Dashboard → SQL → New query).
-- For Clerk auth, follow the database and JWT setup instructions in README.md.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  handle text unique,
  updated_at timestamptz default now()
);

create table if not exists public.movies (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer,
  media_type text not null default 'movie' check (media_type in ('movie', 'tv')),
  title text not null,
  year integer not null default 0,
  genre text not null default 'Drama',
  director text not null default '—',
  poster_path text,
  poster_class text not null default 'from-zinc-700 to-zinc-900',
  created_at timestamptz default now(),
  constraint movies_tmdb_id_media_type_key unique (tmdb_id, media_type),
  constraint movies_genre_check check (
    genre in (
      'Sci-Fi', 'Drama', 'Thriller', 'Comedy', 'Horror',
      'Animation', 'Action', 'Romance'
    )
  )
);

create table if not exists public.api_rate_limit_counters (
  user_id text not null,
  bucket text not null check (bucket in ('pick_for_me', 'movie_catalog')),
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (user_id, bucket)
);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  is_public boolean not null default false,
  kind text not null default 'collection',
  follower_count integer not null default 0,
  like_count integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint playlists_kind_check check (kind in ('collection', 'watched'))
);

create table if not exists public.playlist_items (
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  movie_id uuid not null references public.movies (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (playlist_id, movie_id)
);

create table if not exists public.saved_movies (
  user_id uuid not null references auth.users (id) on delete cascade,
  movie_id uuid not null references public.movies (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, movie_id)
);

create table if not exists public.playlist_follows (
  user_id uuid not null references auth.users (id) on delete cascade,
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, playlist_id)
);

create table if not exists public.playlist_likes (
  user_id uuid not null references auth.users (id) on delete cascade,
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, playlist_id)
);

create index if not exists playlists_user_id_idx on public.playlists (user_id);
create index if not exists playlists_public_idx on public.playlists (is_public) where is_public = true;
create index if not exists playlist_items_playlist_idx on public.playlist_items (playlist_id);
create index if not exists playlist_likes_playlist_idx on public.playlist_likes (playlist_id);
create index if not exists saved_movies_user_idx on public.saved_movies (user_id);

create or replace function public.consume_api_rate_limit(p_bucket text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := auth.jwt()->>'sub';
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_actual_window_start timestamptz;
  v_request_count integer;
  v_max_requests integer;
begin
  if v_user_id is null or p_bucket not in ('pick_for_me', 'movie_catalog') then
    return false;
  end if;

  v_max_requests := case p_bucket
    when 'pick_for_me' then 10
    else 30
  end;
  v_window_start := to_timestamp(floor(extract(epoch from v_now) / 60) * 60);

  insert into public.api_rate_limit_counters (
    user_id,
    bucket,
    window_start,
    request_count
  )
  values (v_user_id, p_bucket, v_window_start, 1)
  on conflict (user_id, bucket) do update
  set
    window_start = case
      when public.api_rate_limit_counters.window_start < excluded.window_start
        then excluded.window_start
      else public.api_rate_limit_counters.window_start
    end,
    request_count = case
      when public.api_rate_limit_counters.window_start < excluded.window_start
        then 1
      when public.api_rate_limit_counters.window_start = excluded.window_start
        then public.api_rate_limit_counters.request_count + 1
      else public.api_rate_limit_counters.request_count
    end
  returning window_start, request_count
    into v_actual_window_start, v_request_count;

  return v_actual_window_start = v_window_start
    and v_request_count <= v_max_requests;
end;
$$;

revoke all on function public.consume_api_rate_limit(text) from public;
revoke all on function public.consume_api_rate_limit(text) from anon;
grant execute on function public.consume_api_rate_limit(text) to authenticated;

-- Release radar bookmarks (“Coming up” in Your theatre)
create table if not exists public.user_release_watchlist (
  user_id uuid not null references auth.users (id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null default 'movie' check (media_type in ('movie', 'tv')),
  release_date text not null,
  title text not null default '',
  poster_path text,
  created_at timestamptz not null default now(),
  primary key (user_id, tmdb_id, media_type)
);

create index if not exists user_release_watchlist_user_release_idx
  on public.user_release_watchlist (user_id, release_date);

-- Explore “Recently viewed” (signed-in users; merged with device localStorage in the app)
create table if not exists public.explore_recent_opens (
  user_id uuid not null references auth.users (id) on delete cascade,
  movie_id uuid not null references public.movies (id) on delete cascade,
  opened_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

create index if not exists explore_recent_opens_user_opened_idx
  on public.explore_recent_opens (user_id, opened_at desc);

-- Per-user tier + short review (community totals via RPC; no design lift from other sites)
create table if not exists public.movie_user_takes (
  user_id uuid not null references auth.users (id) on delete cascade,
  movie_id uuid not null references public.movies (id) on delete cascade,
  tier text not null check (tier in ('skip', 'okay', 'recommend', 'love')),
  review text not null default '' check (char_length(review) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

create index if not exists movie_user_takes_movie_idx on public.movie_user_takes (movie_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists playlists_set_updated_at on public.playlists;
create trigger playlists_set_updated_at
  before update on public.playlists
  for each row execute function public.set_updated_at();

create or replace function public.playlist_follows_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.playlists set follower_count = follower_count + 1 where id = new.playlist_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.playlists set follower_count = greatest(0, follower_count - 1) where id = old.playlist_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists playlist_follows_after_insert on public.playlist_follows;
drop trigger if exists playlist_follows_after_delete on public.playlist_follows;
drop trigger if exists playlist_follows_after_change on public.playlist_follows;
create trigger playlist_follows_after_change
  after insert or delete on public.playlist_follows
  for each row execute function public.playlist_follows_after_change();

create or replace function public.playlist_likes_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.playlists set like_count = like_count + 1 where id = new.playlist_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.playlists set like_count = greatest(0, like_count - 1) where id = old.playlist_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists playlist_likes_after_change on public.playlist_likes;
create trigger playlist_likes_after_change
  after insert or delete on public.playlist_likes
  for each row execute function public.playlist_likes_after_change();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, handle)
  values (
    new.id,
    coalesce(
      nullif(
        trim(
          concat_ws(
            ' ',
            nullif(trim(new.raw_user_meta_data->>'first_name'), ''),
            nullif(trim(new.raw_user_meta_data->>'last_name'), '')
          )
        ),
        ''
      ),
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      'Movie fan'
    ),
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists movie_user_takes_set_updated_at on public.movie_user_takes;
create trigger movie_user_takes_set_updated_at
  before update on public.movie_user_takes
  for each row execute function public.set_updated_at();

-- Aggregated tier counts by TMDB id (no row leak; security definer)
create or replace function public.get_movie_take_meter_by_tmdb(p_tmdb_id integer)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'skip', count(*) filter (where t.tier = 'skip'),
        'okay', count(*) filter (where t.tier = 'okay'),
        'recommend', count(*) filter (where t.tier = 'recommend'),
        'love', count(*) filter (where t.tier = 'love')
      )
      from public.movie_user_takes t
      inner join public.movies m on m.id = t.movie_id
      where m.tmdb_id = p_tmdb_id
    ),
    '{"skip":0,"okay":0,"recommend":0,"love":0}'::jsonb
  );
$$;

revoke all on function public.get_movie_take_meter_by_tmdb(integer) from public;
grant execute on function public.get_movie_take_meter_by_tmdb(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.movies enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_items enable row level security;
alter table public.saved_movies enable row level security;
alter table public.user_release_watchlist enable row level security;
alter table public.explore_recent_opens enable row level security;
alter table public.movie_user_takes enable row level security;
alter table public.playlist_follows enable row level security;
alter table public.playlist_likes enable row level security;
alter table public.api_rate_limit_counters enable row level security;

-- Profiles: readable for explore; users manage their own row
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles for select using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Movies: any signed-in user can read; insert/update for catalog growth
drop policy if exists "movies_select_authed" on public.movies;
create policy "movies_select_authed" on public.movies for select to authenticated using (true);

drop policy if exists "movies_insert_authed" on public.movies;
drop policy if exists "movies_update_authed" on public.movies;
revoke insert, update on public.movies from anon, authenticated;

revoke all on public.api_rate_limit_counters from public, anon, authenticated;

-- Playlists
drop policy if exists "playlists_select_visible" on public.playlists;
create policy "playlists_select_visible" on public.playlists for select using (
  is_public = true or auth.uid() = user_id
);

drop policy if exists "playlists_insert_own" on public.playlists;
create policy "playlists_insert_own" on public.playlists for insert with check (auth.uid() = user_id);

drop policy if exists "playlists_update_own" on public.playlists;
create policy "playlists_update_own" on public.playlists for update using (auth.uid() = user_id);

drop policy if exists "playlists_delete_own" on public.playlists;
create policy "playlists_delete_own" on public.playlists for delete using (auth.uid() = user_id);

-- Playlist items: visible if parent playlist is visible; mutate if owner
drop policy if exists "playlist_items_select" on public.playlist_items;
create policy "playlist_items_select" on public.playlist_items for select using (
  exists (
    select 1 from public.playlists p
    where p.id = playlist_items.playlist_id
      and (p.is_public or p.user_id = auth.uid())
  )
);

drop policy if exists "playlist_items_insert" on public.playlist_items;
create policy "playlist_items_insert" on public.playlist_items for insert with check (
  exists (
    select 1 from public.playlists p
    where p.id = playlist_items.playlist_id and p.user_id = auth.uid()
  )
);

drop policy if exists "playlist_items_update" on public.playlist_items;
create policy "playlist_items_update" on public.playlist_items for update using (
  exists (
    select 1 from public.playlists p
    where p.id = playlist_items.playlist_id and p.user_id = auth.uid()
  )
);

drop policy if exists "playlist_items_delete" on public.playlist_items;
create policy "playlist_items_delete" on public.playlist_items for delete using (
  exists (
    select 1 from public.playlists p
    where p.id = playlist_items.playlist_id and p.user_id = auth.uid()
  )
);

-- Saved movies
drop policy if exists "saved_select_own" on public.saved_movies;
create policy "saved_select_own" on public.saved_movies for select using (auth.uid() = user_id);

drop policy if exists "saved_insert_own" on public.saved_movies;
create policy "saved_insert_own" on public.saved_movies for insert with check (auth.uid() = user_id);

drop policy if exists "saved_delete_own" on public.saved_movies;
create policy "saved_delete_own" on public.saved_movies for delete using (auth.uid() = user_id);

-- Release radar bookmarks
drop policy if exists "release_watch_select_own" on public.user_release_watchlist;
create policy "release_watch_select_own" on public.user_release_watchlist
  for select using (auth.uid() = user_id);

drop policy if exists "release_watch_insert_own" on public.user_release_watchlist;
create policy "release_watch_insert_own" on public.user_release_watchlist
  for insert with check (auth.uid() = user_id);

drop policy if exists "release_watch_update_own" on public.user_release_watchlist;
create policy "release_watch_update_own" on public.user_release_watchlist
  for update using (auth.uid() = user_id);

drop policy if exists "release_watch_delete_own" on public.user_release_watchlist;
create policy "release_watch_delete_own" on public.user_release_watchlist
  for delete using (auth.uid() = user_id);

-- Explore recent opens (per user; upsert updates opened_at)
drop policy if exists "explore_recent_select_own" on public.explore_recent_opens;
create policy "explore_recent_select_own" on public.explore_recent_opens for select using (auth.uid() = user_id);

drop policy if exists "explore_recent_insert_own" on public.explore_recent_opens;
create policy "explore_recent_insert_own" on public.explore_recent_opens for insert with check (auth.uid() = user_id);

drop policy if exists "explore_recent_update_own" on public.explore_recent_opens;
create policy "explore_recent_update_own" on public.explore_recent_opens for update using (auth.uid() = user_id);

drop policy if exists "explore_recent_delete_own" on public.explore_recent_opens;
create policy "explore_recent_delete_own" on public.explore_recent_opens for delete using (auth.uid() = user_id);

-- Follows (only see your own follows; public follower counts live on playlists.follower_count)
drop policy if exists "follows_select_own" on public.playlist_follows;
create policy "follows_select_own" on public.playlist_follows for select using (auth.uid() = user_id);

drop policy if exists "follows_insert_own" on public.playlist_follows;
create policy "follows_insert_own" on public.playlist_follows for insert with check (auth.uid() = user_id);

drop policy if exists "follows_delete_own" on public.playlist_follows;
create policy "follows_delete_own" on public.playlist_follows for delete using (auth.uid() = user_id);

-- Playlist likes (heart on Explore — counts on playlists.like_count)
drop policy if exists "likes_select_own" on public.playlist_likes;
create policy "likes_select_own" on public.playlist_likes for select using (auth.uid() = user_id);

drop policy if exists "likes_insert_own" on public.playlist_likes;
create policy "likes_insert_own" on public.playlist_likes for insert with check (auth.uid() = user_id);

drop policy if exists "likes_delete_own" on public.playlist_likes;
create policy "likes_delete_own" on public.playlist_likes for delete using (auth.uid() = user_id);

-- Movie takes (your tier + review; community meter uses RPC only)
drop policy if exists "movie_takes_select_own" on public.movie_user_takes;
drop policy if exists "movie_takes_select_visible" on public.movie_user_takes;
create policy "movie_takes_select_visible" on public.movie_user_takes for select using (
  auth.uid() = user_id
  or (auth.uid() is not null and coalesce(trim(review), '') <> '')
);

drop policy if exists "movie_takes_insert_own" on public.movie_user_takes;
create policy "movie_takes_insert_own" on public.movie_user_takes for insert with check (auth.uid() = user_id);

drop policy if exists "movie_takes_update_own" on public.movie_user_takes;
create policy "movie_takes_update_own" on public.movie_user_takes for update using (auth.uid() = user_id);

drop policy if exists "movie_takes_delete_own" on public.movie_user_takes;
create policy "movie_takes_delete_own" on public.movie_user_takes for delete using (auth.uid() = user_id);

-- Written-review likes & replies (if using Clerk text ids, run migrate-clerk-user-ids.sql)
create table if not exists public.movie_take_review_likes (
  movie_id uuid not null references public.movies (id) on delete cascade,
  review_author_id uuid not null references auth.users (id) on delete cascade,
  liked_by_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (movie_id, review_author_id, liked_by_user_id),
  constraint movie_take_review_likes_no_self check (review_author_id <> liked_by_user_id)
);

create index if not exists movie_take_review_likes_movie_idx
  on public.movie_take_review_likes (movie_id);
create index if not exists movie_take_review_likes_author_idx
  on public.movie_take_review_likes (movie_id, review_author_id);

create table if not exists public.movie_take_review_replies (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references public.movies (id) on delete cascade,
  review_author_id uuid not null references auth.users (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null
    check (char_length(body) <= 1000 and char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists movie_take_review_replies_thread_idx
  on public.movie_take_review_replies (movie_id, review_author_id, created_at);

alter table public.movie_take_review_likes enable row level security;
alter table public.movie_take_review_replies enable row level security;

drop policy if exists "movie_review_likes_select_auth" on public.movie_take_review_likes;
create policy "movie_review_likes_select_auth" on public.movie_take_review_likes
  for select using (auth.uid() is not null);

drop policy if exists "movie_review_likes_insert_own" on public.movie_take_review_likes;
create policy "movie_review_likes_insert_own" on public.movie_take_review_likes
  for insert with check (
    auth.uid() = liked_by_user_id
    and review_author_id <> liked_by_user_id
  );

drop policy if exists "movie_review_likes_delete_own" on public.movie_take_review_likes;
create policy "movie_review_likes_delete_own" on public.movie_take_review_likes
  for delete using (auth.uid() = liked_by_user_id);

drop policy if exists "movie_review_replies_select_auth" on public.movie_take_review_replies;
create policy "movie_review_replies_select_auth" on public.movie_take_review_replies
  for select using (auth.uid() is not null);

drop policy if exists "movie_review_replies_insert_own" on public.movie_take_review_replies;
create policy "movie_review_replies_insert_own" on public.movie_take_review_replies
  for insert with check (auth.uid() = user_id);

drop policy if exists "movie_review_replies_delete_own" on public.movie_take_review_replies;
create policy "movie_review_replies_delete_own" on public.movie_take_review_replies
  for delete using (auth.uid() = user_id);
