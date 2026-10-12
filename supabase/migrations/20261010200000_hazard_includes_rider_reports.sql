-- NOT YET APPLIED to the live project (waiting on approval, since it drops and rebuilds the view).
-- Counts rider reports toward each cell's hazard score, weighted 0.7 against robot detections.
drop materialized view if exists internal.cell_hazard;
create materialized view internal.cell_hazard as
with obs as (
  select cell_id, seen_at as at, est_shards::numeric as shards, 1.0 as weight
  from public.detections where er_verdict = 'glass'
  union all
  select cell_id, created_at, coalesce(shards, 5)::numeric, 0.7
  from public.rider_reports where verdict = 'glass' and status <> 'rejected' and cell_id is not null
)
select c.id,
  coalesce(sum(o.weight * o.shards * exp(-extract(epoch from now() - o.at) / (3*86400))), 0) as decayed,
  count(o.cell_id) filter (where o.at > now() - interval '30 days') as recur_30d
from public.lane_cells c
left join obs o on o.cell_id = c.id
group by c.id;
create unique index cell_hazard_id_idx on internal.cell_hazard (id);
