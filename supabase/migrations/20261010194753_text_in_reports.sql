-- texted reports (MMS / WhatsApp) have no device id
alter table public.rider_reports alter column device_id drop not null;
alter table public.rider_reports add column if not exists channel text check (channel in ('app','sms','mms','whatsapp'));
alter table public.rider_reports add column if not exists reporter_hash text;
alter table public.rider_reports add column if not exists location_source text check (location_source in ('device','exif','pin','cross_streets'));
alter table public.rider_reports add column if not exists place_text text;
create index if not exists rider_reports_reporter_idx on public.rider_reports (reporter_hash, created_at desc);

-- a photo waiting for its location, keyed by a salted hash of the sender's number
create table public.text_sessions (
  reporter_hash  text primary key,
  channel        text not null,
  draft          jsonb not null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default now() + interval '30 minutes'
);
alter table public.text_sessions enable row level security;
