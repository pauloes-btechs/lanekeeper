create extension if not exists postgis with schema extensions;

-- L1: NYC DOT bike routes (NYC Open Data mzxg-pwib)
create table public.lane_segments (
  id          bigint primary key,
  street      text,
  facility    text,
  borough     text,
  geom        extensions.geography(LineString, 4326) not null,
  source_ver  date not null
);

-- L2: stable 25 m cells
create table public.lane_cells (
  id          text primary key,
  segment_id  bigint references public.lane_segments(id),
  seq         int,
  geom        extensions.geography(LineString, 4326) not null
);
create index lane_cells_geom_idx on public.lane_cells using gist (geom);
create index lane_cells_segment_idx on public.lane_cells (segment_id);

create table public.sweepers (
  id        text primary key,
  name      text,
  firmware  text,
  depot     text
);

create table public.runs (
  id             uuid primary key default gen_random_uuid(),
  sweeper_id     text references public.sweepers(id),
  started_at     timestamptz,
  ended_at       timestamptz,
  planned_cells  text[]
);
create index runs_sweeper_idx on public.runs (sweeper_id);

-- L4: what the robot saw
create table public.detections (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid references public.runs(id),
  cell_id     text references public.lane_cells(id),
  seen_at     timestamptz not null default now(),
  location    extensions.geography(Point, 4326) not null,
  edge_conf   real,
  er_verdict  text check (er_verdict in ('glass','not_glass','unsure')),
  er_point    int[],
  est_shards  int,
  frame_path  text
);
create index detections_cell_idx on public.detections (cell_id, seen_at desc);
create index detections_run_idx on public.detections (run_id);
create index detections_loc_idx on public.detections using gist (location);

-- what it fixed
create table public.remediations (
  id            uuid primary key default gen_random_uuid(),
  detection_id  uuid references public.detections(id),
  cell_id       text references public.lane_cells(id),
  cleared_at    timestamptz not null default now(),
  passes        int default 1,
  confirmed     boolean,
  after_path    text
);
create index remediations_cell_idx on public.remediations (cell_id, cleared_at desc);
create index remediations_detection_idx on public.remediations (detection_id);

-- RLS: public can read the map layers and clears; only the fleet (service role) writes
alter table public.lane_segments enable row level security;
alter table public.lane_cells    enable row level security;
alter table public.sweepers      enable row level security;
alter table public.runs          enable row level security;
alter table public.detections    enable row level security;
alter table public.remediations  enable row level security;

create policy "public reads lane segments" on public.lane_segments for select to anon, authenticated using (true);
create policy "public reads lane cells"    on public.lane_cells    for select to anon, authenticated using (true);
create policy "public reads clears"        on public.remediations  for select to anon, authenticated using (true);

-- live map feed
alter publication supabase_realtime add table public.remediations;

-- hazard ranking, kept out of the public API
create schema if not exists internal;
create materialized view internal.cell_hazard as
select c.id,
  coalesce(sum(d.est_shards * exp(-extract(epoch from now() - d.seen_at) / (3*86400))), 0) as decayed,
  count(d.id) filter (where d.seen_at > now() - interval '30 days') as recur_30d
from public.lane_cells c
left join public.detections d on d.cell_id = c.id and d.er_verdict = 'glass'
group by c.id;
create unique index cell_hazard_id_idx on internal.cell_hazard (id);
