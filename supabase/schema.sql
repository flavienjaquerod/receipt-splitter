-- Receipt Splitter Schema
-- Run this in the Supabase SQL editor: https://supabase.com/dashboard/project/_/sql

-- ── Tables ────────────────────────────────────────────────────────────────────

-- User profiles (display name, saved preferences)
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  updated_at timestamptz default now()
);

-- Receipts (one per upload/manual session)
create table if not exists receipts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  name       text not null,
  created_at timestamptz default now()
);

-- Images attached to a receipt (stored in Supabase Storage)
create table if not exists receipt_images (
  id           uuid primary key default gen_random_uuid(),
  receipt_id   uuid references receipts(id) on delete cascade not null,
  storage_path text not null,   -- path inside the 'receipts' bucket
  filename     text not null,
  created_at   timestamptz default now()
);

-- Items (only the user's own share is stored)
create table if not exists items (
  id              uuid primary key default gen_random_uuid(),
  receipt_id      uuid references receipts(id) on delete cascade not null,
  name            text not null,
  translated_name text,
  original_price  numeric(10,2) not null,
  current_price   numeric(10,2) not null,  -- user's share of the item
  category        text,
  confidence      int,
  source_file     text,
  created_at      timestamptz default now()
);

-- Recurring payments (rent, subscriptions, etc.)
create table if not exists recurring_payments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  name       text not null,
  amount     numeric(10,2) not null,
  category   text not null default 'other',
  frequency  text not null default 'monthly',  -- monthly | yearly
  start_date date not null default current_date,
  created_at timestamptz default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table profiles           enable row level security;
alter table receipts           enable row level security;
alter table receipt_images     enable row level security;
alter table items              enable row level security;
alter table recurring_payments enable row level security;

create policy "own profile"    on profiles           for all using (auth.uid() = id);
create policy "own receipts"   on receipts           for all using (auth.uid() = user_id);
create policy "own recurring"  on recurring_payments for all using (auth.uid() = user_id);
create policy "own images"     on receipt_images for all using (
  exists (
    select 1 from receipts
    where receipts.id = receipt_images.receipt_id
      and receipts.user_id = auth.uid()
  )
);
create policy "own items"      on items for all using (
  exists (
    select 1 from receipts
    where receipts.id = items.receipt_id
      and receipts.user_id = auth.uid()
  )
);

-- ── Storage bucket ────────────────────────────────────────────────────────────
-- Run this separately in the Supabase SQL editor:
--
-- insert into storage.buckets (id, name, public)
-- values ('receipts', 'receipts', false)
-- on conflict do nothing;
--
-- create policy "upload own receipts" on storage.objects
--   for insert with check (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
--
-- create policy "read own receipts" on storage.objects
--   for select using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
--
-- create policy "delete own receipts" on storage.objects
--   for delete using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

-- ── Auto-create profile on signup ─────────────────────────────────────────────

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
