-- Demo data: 1st Ave protected lane, E 14th St to E 72nd St (approximate line), cut into 25 m cells,
-- one sweeper and one 4-6 a.m. run with three cleared glass spots.
insert into public.lane_segments (id, street, facility, borough, geom, source_ver) values
 (900001, '1st Ave', 'protected', 'Manhattan',
  extensions.st_geogfromtext('LINESTRING(-73.9824 40.7316, -73.9727 40.7449, -73.9615 40.7592, -73.9548 40.7676)'), '2026-07-24');

with seg as (select id, geom::extensions.geometry g, extensions.st_length(geom) len from public.lane_segments where id = 900001),
n as (select generate_series(0, floor(len/25)::int - 1) i, len, g, id from seg)
insert into public.lane_cells (id, segment_id, seq, geom)
select 'MN-1AV-' || lpad(i::text, 4, '0'), id, i,
       extensions.st_linesubstring(g, (i*25)/len, least(((i+1)*25)/len, 1))::extensions.geography
from n;

insert into public.sweepers values ('LK-01', 'Lanekeeper 01', '0.1.0-demo', 'E 20th St depot');
insert into public.runs (sweeper_id, started_at, ended_at, planned_cells)
values ('LK-01', '2026-10-10 04:00-04', '2026-10-10 05:52-04', array['MN-1AV-0040','MN-1AV-0112','MN-1AV-0160']);

with r as (select id from public.runs limit 1),
d as (
  insert into public.detections (run_id, cell_id, seen_at, location, edge_conf, er_verdict, er_point, est_shards)
  select r.id, c.id, ts::timestamptz,
         extensions.st_lineinterpolatepoint(c.geom::extensions.geometry, 0.5)::extensions.geography,
         conf, 'glass', pt, shards
  from r, (values ('MN-1AV-0040','2026-10-10 04:21-04',0.81,array[612,488],14),
                  ('MN-1AV-0112','2026-10-10 04:58-04',0.74,array[540,372],6),
                  ('MN-1AV-0160','2026-10-10 05:37-04',0.88,array[701,515],23)) v(cell, ts, conf, pt, shards)
  join public.lane_cells c on c.id = v.cell
  returning id, cell_id, seen_at
)
insert into public.remediations (detection_id, cell_id, cleared_at, passes, confirmed)
select id, cell_id, seen_at + interval '40 seconds',
       case when cell_id = 'MN-1AV-0160' then 2 else 1 end, true from d;

refresh materialized view internal.cell_hazard;
