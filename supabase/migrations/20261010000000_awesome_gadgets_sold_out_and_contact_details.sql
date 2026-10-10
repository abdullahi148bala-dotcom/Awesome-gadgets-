alter table public.store_products
  add column if not exists is_sold_out boolean not null default false;

alter table public.store_sites
  add column if not exists address text not null default '',
  add column if not exists maps_url text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists instagram_url text not null default '',
  add column if not exists tiktok_url text not null default '',
  add column if not exists facebook_url text not null default '';

comment on column public.store_products.is_sold_out is
  'When true, the product is excluded from public catalogues and cannot be ordered.';
