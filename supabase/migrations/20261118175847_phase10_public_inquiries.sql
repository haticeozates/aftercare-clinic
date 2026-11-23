create table public.public_inquiries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('demo', 'contact')),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  email text not null check (char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  clinic text check (clinic is null or char_length(btrim(clinic)) between 2 and 140),
  message text check (message is null or char_length(btrim(message)) between 10 and 1000),
  created_at timestamptz not null default now(),
  check ((kind = 'demo' and clinic is not null) or (kind = 'contact' and message is not null))
);

alter table public.public_inquiries enable row level security;
alter table public.public_inquiries force row level security;
revoke all on public.public_inquiries from public, anon, authenticated, service_role;
grant insert (kind, name, email, clinic, message) on public.public_inquiries to service_role;
