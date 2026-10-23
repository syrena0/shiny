-- Run in the Supabase SQL editor as the project owner. Existing rows are retained.
-- Original catalog identifiers remain stable even if an existing table uses UUID ids.
create table if not exists public.products (id text primary key);
alter table public.products
 add column if not exists catalog_id text,
 add column if not exists brand text,
 add column if not exists name text,
 add column if not exists category text,
 add column if not exists price_azn numeric,
 add column if not exists rating numeric,
 add column if not exists image text,
 add column if not exists skin_type jsonb,
 add column if not exists finish text,
 add column if not exists description jsonb,
 add column if not exists shades jsonb,
 add column if not exists stores jsonb,
 add column if not exists dupes jsonb,
 add column if not exists catalog_data jsonb not null default '{}'::jsonb;
update public.products set catalog_id=coalesce(catalog_data->>'id',id::text) where catalog_id is null;
create unique index if not exists products_catalog_id_key on public.products(catalog_id);
alter table public.products enable row level security;
grant select on public.products to anon, authenticated;
drop policy if exists shiny_public_catalog_read on public.products;
create policy shiny_public_catalog_read on public.products for select to anon, authenticated using (true);
-- No anonymous INSERT/UPDATE/DELETE policies are created. Browser visitors cannot seed or edit.

notify pgrst, 'reload schema';
