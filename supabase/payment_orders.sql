create extension if not exists pgcrypto;

create table if not exists public.payment_orders (
  order_id text primary key,
  hdfc_order_ref text,
  customer_id text not null,
  customer_name text,
  customer_email text,
  customer_phone text,
  amount numeric(12,2) not null,
  currency text not null default 'INR',
  status text not null default 'PENDING',
  transaction_id text,
  payment_method_type text,
  verified boolean not null default false,
  verification_source text,
  gateway_response jsonb,
  gateway_status_response jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists payment_orders_transaction_id_key
  on public.payment_orders (transaction_id)
  where transaction_id is not null;

create index if not exists payment_orders_customer_id_idx
  on public.payment_orders (customer_id);

create index if not exists payment_orders_status_idx
  on public.payment_orders (status);

create or replace function public.set_payment_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists payment_orders_set_updated_at on public.payment_orders;

create trigger payment_orders_set_updated_at
before update on public.payment_orders
for each row
execute function public.set_payment_orders_updated_at();
