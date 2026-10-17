-- One owner per store for the MVP. All customer and inventory rows are tenant scoped.
create extension if not exists pgcrypto;
create table public.stores (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null unique references auth.users(id) on delete cascade,
 name text not null default 'Ma boutique' check(char_length(name) between 1 and 100), phone text not null default '', logo_path text,
 delivery_casa numeric(10,2) not null default 20 check(delivery_casa between 0 and 1000),
 delivery_other numeric(10,2) not null default 35 check(delivery_other between 0 and 1000),
 ai_enabled boolean not null default false, created_at timestamptz not null default now()
);
create table public.products (
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id) on delete cascade,
 name text not null check(char_length(name) between 1 and 120),description text not null default '' check(char_length(description)<=1000),
 price_mad numeric(10,2) not null check(price_mad>0 and price_mad<=100000),active boolean not null default true,
 created_at timestamptz not null default now(),unique(store_id,id)
);
create table public.product_variants (
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id) on delete cascade,
 product_id uuid not null,size text not null check(size in ('S','M','L','XL')),color text not null check(char_length(color) between 1 and 40),
 stock integer not null default 0 check(stock between 0 and 1000000),
 foreign key(store_id,product_id) references public.products(store_id,id) on delete cascade,
 unique(product_id,size,color),unique(store_id,id)
);
create table public.orders (
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id) on delete cascade,variant_id uuid,
 customer_name text not null check(char_length(customer_name) between 1 and 100),phone text not null check(phone ~ '^\+[1-9][0-9]{7,14}$'),
 city text not null check(char_length(city) between 1 and 100),address text not null check(char_length(address) between 3 and 500),
 product_name text not null,size text not null,color text not null,quantity integer not null check(quantity between 1 and 20),
 unit_price_mad numeric(10,2) not null check(unit_price_mad>0),delivery_fee_mad numeric(10,2) not null check(delivery_fee_mad>=0),
 total_mad numeric(12,2) generated always as(unit_price_mad*quantity+delivery_fee_mad) stored,
 status text not null default 'PENDING' check(status in ('PENDING','CONFIRMED','CANCELLED','SHIPPED')),
 source_message_id text not null check(char_length(source_message_id) between 1 and 200),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(store_id,source_message_id),foreign key(store_id,variant_id) references public.product_variants(store_id,id)
);
create table public.messages (
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id) on delete cascade,
 phone text not null,provider_id text not null,role text not null check(role in ('user','assistant')),content text not null check(char_length(content)<=6000),
 created_at timestamptz not null default now(),unique(store_id,provider_id,role)
);
create table public.webhook_events (
 store_id uuid not null references public.stores(id) on delete cascade,event_id text not null,
 state text not null default 'processing' check(state in ('processing','done','failed')),
 attempts integer not null default 1,lease_until timestamptz not null default now()+interval '3 minutes',
 response jsonb,created_at timestamptz not null default now(),primary key(store_id,event_id)
);
create table public.ai_usage (
 store_id uuid not null references public.stores(id) on delete cascade,bucket timestamptz not null,calls integer not null default 0,
 primary key(store_id,bucket)
);
create index products_store_idx on public.products(store_id);
create index variants_store_idx on public.product_variants(store_id);
create index orders_store_created_idx on public.orders(store_id,created_at desc);
create index messages_conversation_idx on public.messages(store_id,phone,created_at desc);

alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.messages enable row level security;
alter table public.webhook_events enable row level security;
alter table public.ai_usage enable row level security;
create policy stores_select on public.stores for select to authenticated using(owner_id=(select auth.uid()));
create policy stores_insert on public.stores for insert to authenticated with check(owner_id=(select auth.uid()));
create policy stores_update on public.stores for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
-- Ownership is checked through the parent store; ownership metadata is never trusted.
create policy products_owner on public.products for all to authenticated using(store_id in(select id from public.stores where owner_id=(select auth.uid()))) with check(store_id in(select id from public.stores where owner_id=(select auth.uid())));
create policy variants_owner on public.product_variants for all to authenticated using(store_id in(select id from public.stores where owner_id=(select auth.uid()))) with check(store_id in(select id from public.stores where owner_id=(select auth.uid())));
create policy orders_read on public.orders for select to authenticated using(store_id in(select id from public.stores where owner_id=(select auth.uid())));
create policy messages_read on public.messages for select to authenticated using(store_id in(select id from public.stores where owner_id=(select auth.uid())));
-- No authenticated/anon policies on webhook_events and ai_usage: server only.
revoke all on public.stores,public.products,public.product_variants,public.orders,public.messages,public.webhook_events,public.ai_usage from anon,authenticated;
grant select,insert,update on public.stores to authenticated;
grant select,insert,update,delete on public.products,public.product_variants to authenticated;
grant select on public.orders,public.messages to authenticated;
grant all on public.stores,public.products,public.product_variants,public.orders,public.messages,public.webhook_events,public.ai_usage to service_role;

-- Called with the owner's JWT. Inventory changes are atomic with product edits.
create function public.save_product(p_store_id uuid,p_product jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare new_product_id uuid;v jsonb;variant_id uuid;
begin
 if not exists(select 1 from public.stores where id=p_store_id and owner_id=(select auth.uid())) then raise exception 'Forbidden';end if;
 if jsonb_array_length(p_product->'variants') not between 1 and 100 then raise exception 'Invalid variants';end if;
 new_product_id=coalesce(nullif(p_product->>'id','')::uuid,gen_random_uuid());
 insert into public.products(id,store_id,name,description,price_mad,active) values(new_product_id,p_store_id,p_product->>'name',coalesce(p_product->>'description',''),(p_product->>'price_mad')::numeric,(p_product->>'active')::boolean)
 on conflict(id) do update set name=excluded.name,description=excluded.description,price_mad=excluded.price_mad,active=excluded.active where products.store_id=p_store_id;
 if not found then raise exception 'Forbidden';end if;
 for v in select * from jsonb_array_elements(p_product->'variants') loop
  variant_id=coalesce(nullif(v->>'id','')::uuid,gen_random_uuid());
  insert into public.product_variants(id,store_id,product_id,size,color,stock) values(variant_id,p_store_id,new_product_id,v->>'size',v->>'color',(v->>'stock')::integer)
  on conflict(id) do update set size=excluded.size,color=excluded.color,stock=excluded.stock where product_variants.store_id=p_store_id and product_variants.product_id=new_product_id;
  if not found then raise exception 'Forbidden';end if;
 end loop;
 return new_product_id;
end $$;
revoke all on function public.save_product(uuid,jsonb) from public,anon;
grant execute on function public.save_product(uuid,jsonb) to authenticated;

-- Service-only order commit. A row lock prevents concurrent stock overselling.
create function public.confirm_order(p_store_id uuid,p_variant_id uuid,p_customer_name text,p_phone text,p_city text,p_address text,p_quantity integer,p_message_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v public.product_variants;p public.products;s public.stores;o public.orders;fee numeric;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_store_id::text||p_message_id,0));
 select * into o from public.orders where store_id=p_store_id and source_message_id=p_message_id;
 if found then return to_jsonb(o);end if;
 if p_quantity not between 1 and 20 then raise exception 'Invalid quantity';end if;
 select * into v from public.product_variants where store_id=p_store_id and id=p_variant_id for update;
 if not found or v.stock<p_quantity then raise exception 'Insufficient stock';end if;
 select * into p from public.products where store_id=p_store_id and id=v.product_id and active;
 if not found then raise exception 'Product unavailable';end if;
 select * into s from public.stores where id=p_store_id;
 fee=case when lower(trim(p_city)) in ('casa','casablanca','الدار البيضاء') then s.delivery_casa else s.delivery_other end;
 update public.product_variants set stock=stock-p_quantity where id=v.id;
 insert into public.orders(store_id,variant_id,customer_name,phone,city,address,product_name,size,color,quantity,unit_price_mad,delivery_fee_mad,status,source_message_id)
 values(p_store_id,v.id,p_customer_name,p_phone,p_city,p_address,p.name,v.size,v.color,p_quantity,p.price_mad,fee,'CONFIRMED',p_message_id) returning * into o;
 return to_jsonb(o);
end $$;
revoke all on function public.confirm_order(uuid,uuid,text,text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.confirm_order(uuid,uuid,text,text,text,text,integer,text) to service_role;

-- Owner mutations use the service key only after auth.getUser + store ownership in the route.
-- Direct table updates from browser clients are denied by grants/RLS.
create function public.change_order_status(p_store_id uuid,p_order_id uuid,p_status text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.orders;available integer;
begin
 select * into o from public.orders where store_id=p_store_id and id=p_order_id for update;
 if not found then raise exception 'Order not found';end if;
 if p_status not in ('CONFIRMED','CANCELLED','SHIPPED') then raise exception 'Invalid transition';end if;
 if o.status=p_status then return to_jsonb(o);end if;
 if o.status='SHIPPED' then raise exception 'Shipped orders cannot be changed';end if;
 if p_status='SHIPPED' and o.status<>'CONFIRMED' then raise exception 'Confirm before shipping';end if;
 if p_status='CANCELLED' and o.status='CONFIRMED' then update public.product_variants set stock=stock+o.quantity where id=o.variant_id and store_id=p_store_id;end if;
 if p_status='CONFIRMED' and o.status in ('CANCELLED','PENDING') then
  select stock into available from public.product_variants where id=o.variant_id and store_id=p_store_id for update;
  if not found or available<o.quantity then raise exception 'Insufficient stock';end if;
  update public.product_variants set stock=stock-o.quantity where id=o.variant_id and store_id=p_store_id;
 end if;
 update public.orders set status=p_status,updated_at=now() where id=o.id returning * into o;
 return to_jsonb(o);
end $$;
revoke all on function public.change_order_status(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.change_order_status(uuid,uuid,text) to service_role;

create function public.claim_webhook(p_store_id uuid,p_event_id text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare e public.webhook_events;
begin
 insert into public.webhook_events(store_id,event_id) values(p_store_id,p_event_id) on conflict do nothing;
 if found then return jsonb_build_object('claimed',true);end if;
 select * into e from public.webhook_events where store_id=p_store_id and event_id=p_event_id for update;
 if e.state='done' then return jsonb_build_object('claimed',false,'response',e.response);end if;
 if e.state='processing' and e.lease_until>now() then return jsonb_build_object('claimed',false,'busy',true);end if;
 update public.webhook_events set state='processing',lease_until=now()+interval '3 minutes',attempts=attempts+1 where store_id=p_store_id and event_id=p_event_id;
 return jsonb_build_object('claimed',true);
end $$;
revoke all on function public.claim_webhook(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_webhook(uuid,text) to service_role;
create function public.reserve_ai_call(p_store_id uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare count_calls integer;
begin
 insert into public.ai_usage(store_id,bucket,calls) values(p_store_id,date_trunc('hour',now()),1)
 on conflict(store_id,bucket) do update set calls=ai_usage.calls+1 returning calls into count_calls;
 return count_calls<=100;
end $$;
revoke all on function public.reserve_ai_call(uuid) from public,anon,authenticated;
grant execute on function public.reserve_ai_call(uuid) to service_role;

-- Private logo bucket: folder is the store UUID, and ownership is checked via stores.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('store-logos','store-logos',false,2097152,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
create policy logos_select on storage.objects for select to authenticated using(bucket_id='store-logos' and (storage.foldername(name))[1] in(select id::text from public.stores where owner_id=(select auth.uid())));
create policy logos_insert on storage.objects for insert to authenticated with check(bucket_id='store-logos' and (storage.foldername(name))[1] in(select id::text from public.stores where owner_id=(select auth.uid())));
create policy logos_update on storage.objects for update to authenticated using(bucket_id='store-logos' and (storage.foldername(name))[1] in(select id::text from public.stores where owner_id=(select auth.uid()))) with check(bucket_id='store-logos' and (storage.foldername(name))[1] in(select id::text from public.stores where owner_id=(select auth.uid())));
create policy logos_delete on storage.objects for delete to authenticated using(bucket_id='store-logos' and (storage.foldername(name))[1] in(select id::text from public.stores where owner_id=(select auth.uid())));
-- Add only application tables to the publication; never modify the managed realtime schema.
do $$begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.orders,public.products,public.product_variants;
 end if;
end$$;
