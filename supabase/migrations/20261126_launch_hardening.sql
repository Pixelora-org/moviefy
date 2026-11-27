-- Apply after the base schema and Clerk identity migration, if used.
-- Safe to re-run; no user identity values are rewritten by this migration.

alter table public.movies
  add column if not exists media_type text not null default 'movie';

alter table public.movies
  drop constraint if exists movies_tmdb_id_key;
alter table public.movies
  drop constraint if exists movies_tmdb_id_media_type_key;
alter table public.movies
  add constraint movies_tmdb_id_media_type_key unique (tmdb_id, media_type);

alter table public.movies
  drop constraint if exists movies_media_type_check;
alter table public.movies
  add constraint movies_media_type_check check (media_type in ('movie', 'tv'));

drop policy if exists "movies_insert_authed" on public.movies;
drop policy if exists "movies_update_authed" on public.movies;
revoke insert, update on public.movies from anon, authenticated;

create table if not exists public.api_rate_limit_counters (
  user_id text not null,
  bucket text not null check (bucket in ('pick_for_me', 'movie_catalog')),
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (user_id, bucket)
);

alter table public.api_rate_limit_counters enable row level security;
revoke all on public.api_rate_limit_counters from public, anon, authenticated;

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
