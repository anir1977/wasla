\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
set local role authenticated;
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
insert into public.stores(id,owner_id,name) values('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Store A');
select public.save_product('11111111-1111-4111-8111-111111111111','{"id":"22222222-2222-4222-8222-222222222222","name":"T-shirt","description":"Demo","price_mad":149,"active":true,"variants":[{"id":"33333333-3333-4333-8333-333333333333","size":"M","color":"Noir","stock":2}]}');
-- Product editing must use the same variant and leave the correct stock.
select public.save_product('11111111-1111-4111-8111-111111111111','{"id":"22222222-2222-4222-8222-222222222222","name":"T-shirt","description":"Updated","price_mad":149,"active":true,"variants":[{"id":"33333333-3333-4333-8333-333333333333","size":"M","color":"Noir","stock":2}]}');
set local request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
insert into public.stores(id,owner_id,name) values('99999999-9999-4999-8999-999999999999','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Store B');
do $$begin
 if (select count(*) from public.products)<>0 then raise exception 'RLS leaked another store catalog';end if;
 begin
  perform public.save_product('11111111-1111-4111-8111-111111111111','{"name":"Attack","price_mad":1,"variants":[]}');
  raise exception 'Cross-tenant RPC accepted';
 exception when raise_exception then if sqlerrm='Cross-tenant RPC accepted' then raise;end if;end;
 begin
  perform public.confirm_order('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','Test','+212600000000','Casa','Test address',1,'event');
  raise exception 'Browser allowed confirm_order';
 exception when insufficient_privilege then null;end;
end$$;
set local role service_role;
select public.confirm_order('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','Test','+212600000000','Casa','Test address',1,'event1');
select public.confirm_order('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','Test','+212600000000','Casa','Test address',1,'event1');
do $$declare o public.orders;begin
 if (select stock from public.product_variants where id='33333333-3333-4333-8333-333333333333')<>1 then raise exception 'Replay decremented stock twice';end if;
 if (select count(*) from public.orders)<>1 then raise exception 'Replay duplicated order';end if;
 select * into o from public.orders limit 1;
 if o.total_mad<>169 then raise exception 'Incorrect server-side pricing';end if;
 perform public.change_order_status(o.store_id,o.id,'CANCELLED');
 perform public.change_order_status(o.store_id,o.id,'CANCELLED');
 if (select stock from public.product_variants where id=o.variant_id)<>2 then raise exception 'Cancellation stock incorrect';end if;
 perform public.change_order_status(o.store_id,o.id,'CONFIRMED');
 if (select stock from public.product_variants where id=o.variant_id)<>1 then raise exception 'Reconfirmation stock incorrect';end if;
 begin
  perform public.confirm_order(o.store_id,o.variant_id,'Other','+212600000001','Rabat','Other address',2,'event2');
  raise exception 'Oversold inventory';
 exception when raise_exception then if sqlerrm='Oversold inventory' then raise;end if;end;
end$$;
set local role authenticated;
set local request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
do $$begin
 if (select count(*) from public.orders)<>0 then raise exception 'RLS leaked orders';end if;
 if (select count(*) from public.stores)<>1 then raise exception 'RLS leaked stores';end if;
 begin
  update public.stores set owner_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where id='11111111-1111-4111-8111-111111111111';
 exception when insufficient_privilege then null;end;
end$$;
rollback;
select 'Tenant isolation, server-only RPCs, idempotency, inventory, cancellation and pricing tests PASSED' as result;
