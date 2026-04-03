-- Receipt Splitter Schema
-- Run this in the Supabase SQL editor: https://supabase.com/dashboard/project/_/sql

-- Roommates belonging to a user (persistent across sessions)
create table if not exists roommates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  name       text not null,
  color_light text not null,
  color_dark  text not null,
  text_light  text not null,
  text_dark   text not null,
  position   int  not null default 0,
  created_at timestamptz default now()
);

-- Receipts (one per upload session)
create table if not exists receipts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  name       text not null,
  created_at timestamptz default now()
);

-- Items parsed from receipts (or added manually)
create table if not exists items (
  id              uuid primary key default gen_random_uuid(),
  receipt_id      uuid references receipts(id) on delete cascade not null,
  name            text not null,
  translated_name text,
  original_price  numeric(10,2) not null,
  current_price   numeric(10,2) not null,
  category        text,
  confidence      int,
  source_file     text,
  created_at      timestamptz default now()
);

-- Which roommates are assigned to each item
create table if not exists assignments (
  item_id     uuid references items(id) on delete cascade not null,
  roommate_id uuid references roommates(id) on delete cascade not null,
  primary key (item_id, roommate_id)
);

-- ── Row Level Security ───────────────────────────────────────────────────────

alter table roommates  enable row level security;
alter table receipts   enable row level security;
alter table items      enable row level security;
alter table assignments enable row level security;

-- Users can only access their own roommates
create policy "own roommates" on roommates
  for all using (auth.uid() = user_id);

-- Users can only access their own receipts
create policy "own receipts" on receipts
  for all using (auth.uid() = user_id);

-- Users can only access items that belong to their receipts
create policy "own items" on items
  for all using (
    exists (
      select 1 from receipts
      where receipts.id = items.receipt_id
        and receipts.user_id = auth.uid()
    )
  );

-- Users can only access assignments for their items
create policy "own assignments" on assignments
  for all using (
    exists (
      select 1 from items
      join receipts on receipts.id = items.receipt_id
      where items.id = assignments.item_id
        and receipts.user_id = auth.uid()
    )
  );
