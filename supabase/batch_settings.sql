-- SQL Migration for Workshop Batch Settings in Supabase Database
-- Run this in Supabase SQL Editor if you wish to persist batch dates & WhatsApp group link in Supabase DB

create table if not exists public.batch_settings (
  id text primary key default 'default',
  dates text,
  month text,
  timing text,
  mode text,
  seats_text text,
  status text,
  whatsapp_link text,
  updated_at timestamptz not null default timezone('utc', now())
);

-- If table already exists, add whatsapp_link column if not present
alter table public.batch_settings add column if not exists whatsapp_link text;

-- Enable Row Level Security (RLS) & Policies
alter table public.batch_settings enable row level security;

-- Allow anonymous read access to batch_settings (Public landing page & payment confirmation)
create policy "Allow public read access to batch settings"
  on public.batch_settings for select
  using (true);

-- Allow service role access for admin updates
create policy "Allow service role full access to batch settings"
  on public.batch_settings for all
  using (true);
