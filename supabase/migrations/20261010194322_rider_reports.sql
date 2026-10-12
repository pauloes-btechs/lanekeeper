-- glass reported by riders
create table public.rider_reports (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  device_id     uuid not null,
  ip_hash       text,
  location      extensions.geography(Point, 4326) not null,
  accuracy_m    real,
  heading       real,
  taken_at      timestamptz,
  note          text check (char_length(note) <= 280),
  photo_path    text,
  verdict       text check (verdict in ('glass','not_glass','unsure')),
  shards        int,
  severity      text check (severity in ('low','medium','high')),
  on_bike_lane  boolean,
  points        jsonb,
  model         text,
  cell_id       text references public.lane_cells(id),
  distance_m    real,
  status        text not null default 'open' check (status in ('open','queued','cleared','rejected'))
);
create index rider_reports_loc_idx on public.rider_reports using gist (location);
create index rider_reports_cell_idx on public.rider_reports (cell_id, created_at desc);
create index rider_reports_device_idx on public.rider_reports (device_id, created_at desc);
create index rider_reports_ip_idx on public.rider_reports (ip_hash, created_at desc);

-- written only by edge functions (service role); no public policies
alter table public.rider_reports enable row level security;

-- snap each report to the nearest lane cell within 30 m and queue confirmed glass
create or replace function internal.snap_rider_report()
returns trigger language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  select lc.id, extensions.st_distance(lc.geom, new.location) as d
    into c
  from public.lane_cells lc
  where extensions.st_dwithin(lc.geom, new.location, 30)
  order by extensions.st_distance(lc.geom, new.location)
  limit 1;
  if found then
    new.cell_id := c.id;
    new.distance_m := c.d;
  end if;
  if new.verdict = 'glass' and new.status = 'open' then
    new.status := 'queued';
  end if;
  return new;
end $$;

create trigger rider_report_snap
before insert on public.rider_reports
for each row execute function internal.snap_rider_report();

-- private bucket for rider photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rider-photos', 'rider-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;
