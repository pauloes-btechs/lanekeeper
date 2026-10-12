create extension if not exists pg_net with schema extensions;

-- photo / frame checks sent to Gemini through verify-glass
create table public.frame_checks (
  id            bigint generated always as identity primary key,
  label         text,
  source        text default 'upload',
  requested_at  timestamptz not null default now(),
  request_id    bigint,
  status        int,
  verdict       text,
  shards        int,
  points        jsonb,
  model         text,
  error         text,
  checked_at    timestamptz
);
alter table public.frame_checks enable row level security;
create policy "public reads frame checks" on public.frame_checks for select to anon, authenticated using (true);

-- The bearer token below is the project's public anon key (safe to publish; RLS protects data).
-- verify-glass checks the JWT, so a caller needs at least this key.
create or replace function internal.check_frame(frame_b64 text, frame_label text, mime text default 'image/jpeg')
returns bigint language plpgsql security definer set search_path = '' as $$
declare rid bigint; fid bigint;
begin
  select net.http_post(
    url := 'https://fvvxmvtoozpxmdkdumrx.supabase.co/functions/v1/verify-glass',
    body := jsonb_build_object('frameB64', frame_b64, 'mimeType', mime),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2dnhtdnRvb3pweG1ka2R1bXJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NTc0MTEsImV4cCI6MjEwNzIzMzQxMX0.uP7WfaLH2OWMl6ipoR_54inY7JU2b-T_LVzeSy3Xv-0'),
    timeout_milliseconds := 60000) into rid;
  insert into public.frame_checks (label, request_id) values (frame_label, rid) returning id into fid;
  return fid;
end $$;

create or replace function internal.collect_frame(fid bigint)
returns setof public.frame_checks language plpgsql security definer set search_path = '' as $$
declare r record; rq bigint; j jsonb;
begin
  select request_id into rq from public.frame_checks where id = fid;
  select status_code, content, error_msg, timed_out into r from net._http_response where id = rq;
  if found then
    begin j := r.content::jsonb; exception when others then j := null; end;
    update public.frame_checks set
      status  = r.status_code,
      verdict = j->>'verdict',
      shards  = nullif(j->>'shards','')::int,
      points  = j->'points',
      model   = j->>'model',
      error   = coalesce(r.error_msg,
                  case when r.timed_out then 'timed out' end,
                  (j->>'error') || coalesce(': ' || (j->>'detail'), ''),
                  case when j is null and r.status_code >= 400 then left(r.content, 300) end),
      checked_at = now()
    where id = fid and checked_at is null;
  end if;
  return query select * from public.frame_checks where id = fid;
end $$;

revoke all on function internal.check_frame(text, text, text) from public, anon, authenticated;
revoke all on function internal.collect_frame(bigint) from public, anon, authenticated;

-- public run reports, built automatically when a run ends
create table public.run_reports (
  run_id        uuid primary key references public.runs(id),
  slug          text unique not null,
  generated_at  timestamptz not null default now(),
  summary       jsonb not null
);
alter table public.run_reports enable row level security;
create policy "public reads run reports" on public.run_reports for select to anon, authenticated using (true);

create or replace function internal.build_run_report(rid uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'run_id', r.id,
    'sweeper', s.name,
    'sweeper_id', r.sweeper_id,
    'depot', s.depot,
    'started_at', r.started_at,
    'ended_at', r.ended_at,
    'spots_cleared', count(m.id),
    'confirmed', count(m.id) filter (where m.confirmed),
    'shards', coalesce(sum(d.est_shards) filter (where m.id is not null), 0),
    'cleanups', coalesce(jsonb_agg(jsonb_build_object(
        'cell', m.cell_id, 'cleared_at', m.cleared_at, 'shards', d.est_shards,
        'passes', m.passes, 'confirmed', m.confirmed,
        'lat', round(extensions.st_y(d.location::extensions.geometry)::numeric, 5),
        'lng', round(extensions.st_x(d.location::extensions.geometry)::numeric, 5))
        order by m.cleared_at) filter (where m.id is not null), '[]'::jsonb))
  from public.runs r
  left join public.sweepers s on s.id = r.sweeper_id
  left join public.detections d on d.run_id = r.id
  left join public.remediations m on m.detection_id = d.id
  where r.id = rid
  group by r.id, s.name, s.depot;
$$;

create or replace function internal.on_run_ended()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.run_reports (run_id, slug, summary)
  values (new.id,
          to_char(new.started_at at time zone 'America/New_York', 'YYYY-MM-DD') || '-' || lower(new.sweeper_id),
          internal.build_run_report(new.id))
  on conflict (run_id) do update set summary = excluded.summary, generated_at = now();
  return new;
end $$;

create trigger run_ended_report
after insert or update of ended_at on public.runs
for each row when (new.ended_at is not null)
execute function internal.on_run_ended();

-- backfill reports for runs that already ended
insert into public.run_reports (run_id, slug, summary)
select id, to_char(started_at at time zone 'America/New_York', 'YYYY-MM-DD') || '-' || lower(sweeper_id),
       internal.build_run_report(id)
from public.runs where ended_at is not null
on conflict (run_id) do nothing;
