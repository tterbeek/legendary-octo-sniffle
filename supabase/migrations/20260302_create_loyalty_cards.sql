create extension if not exists "pgcrypto";

create table if not exists public.loyalty_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  image_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loyalty_cards_user_name_idx
  on public.loyalty_cards (user_id, name);

alter table public.loyalty_cards enable row level security;

create policy "loyalty_cards_select_own"
  on public.loyalty_cards
  for select
  using (user_id = auth.uid());

create policy "loyalty_cards_insert_own"
  on public.loyalty_cards
  for insert
  with check (user_id = auth.uid());

create policy "loyalty_cards_update_own"
  on public.loyalty_cards
  for update
  using (user_id = auth.uid());

create policy "loyalty_cards_delete_own"
  on public.loyalty_cards
  for delete
  using (user_id = auth.uid());

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_loyalty_cards_updated_at on public.loyalty_cards;
create trigger set_loyalty_cards_updated_at
before update on public.loyalty_cards
for each row
execute function public.set_updated_at();

create policy "loyaltycards_read_own"
  on storage.objects
  for select
  using (bucket_id = 'loyaltycards' and owner = auth.uid());

create policy "loyaltycards_insert_own"
  on storage.objects
  for insert
  with check (bucket_id = 'loyaltycards' and owner = auth.uid());

create policy "loyaltycards_update_own"
  on storage.objects
  for update
  using (bucket_id = 'loyaltycards' and owner = auth.uid());

create policy "loyaltycards_delete_own"
  on storage.objects
  for delete
  using (bucket_id = 'loyaltycards' and owner = auth.uid());
