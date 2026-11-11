-- Demo requests from the marketing site. Additive: creates one table, touches nothing else.
-- Rows are written only by the request-demo edge function (service role), which validates input,
-- checks the honeypot and rate-limits by hashed IP and email before inserting. There is no anon
-- policy at all: a direct anon insert would skip that rate limit, so the function is the only door.
create table public.demo_requests (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null check (char_length(name) between 2 and 120),
  email         text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'),
  city          text not null check (char_length(city) between 2 and 80),
  organization  text not null check (char_length(organization) between 2 and 160),
  role          text check (char_length(role) <= 120),
  lane_miles    numeric check (lane_miles is null or (lane_miles >= 0 and lane_miles <= 100000)),
  message       text check (char_length(message) <= 2000),
  page          text check (char_length(page) <= 200),
  ip_hash       text check (char_length(ip_hash) <= 128),
  email_hash    text check (char_length(email_hash) <= 128),
  status        text not null default 'new' check (status in ('new', 'contacted', 'scheduled', 'closed', 'spam'))
);
create index demo_requests_created_idx on public.demo_requests (created_at desc);
create index demo_requests_ip_idx on public.demo_requests (ip_hash, created_at desc);
create index demo_requests_email_idx on public.demo_requests (email_hash, created_at desc);

alter table public.demo_requests enable row level security;
-- Deliberately no policies: anon and authenticated can neither read nor write.
revoke all on table public.demo_requests from anon, authenticated;
