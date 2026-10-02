create or replace function public.edit_invoice_group(p_invoice_id uuid,p_items jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare invoice_number text; group_key text; expected integer;
begin
 select i.invoice_number into strict invoice_number from public.work_invoices i where i.id=p_invoice_id;
 group_key:=case when invoice_number like 'NGC-G-%/%' then split_part(invoice_number,'/',1) else invoice_number end;
 perform 1 from public.work_invoices i join public.work_orders o on o.id=i.order_id
 where i.invoice_number=group_key or i.invoice_number like group_key||'/%' order by o.id for update of i,o;
 select count(*) into expected from public.work_invoices i where i.invoice_number=group_key or i.invoice_number like group_key||'/%';
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<>expected
 or (select count(distinct item->>'orderId') from jsonb_array_elements(p_items) item)<>expected then raise exception 'Include all invoice visits'; end if;
 if exists(select 1 from public.work_invoices i where (i.invoice_number=group_key or i.invoice_number like group_key||'/%') and i.sent_at is not null) then raise exception 'Sent invoice cannot be changed'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) item
 left join public.work_invoices i on i.order_id=(item->>'orderId')::uuid and (i.invoice_number=group_key or i.invoice_number like group_key||'/%')
 left join public.work_orders o on o.id=i.order_id
 where i.id is null or (item->>'price') is null or (item->>'price')::numeric<o.paid_amount or (item->>'price')::numeric>100000 or (item->>'price')::numeric<0) then raise exception 'Invalid invoice prices'; end if;
 update public.work_invoices i set total=(item->>'price')::numeric from jsonb_array_elements(p_items) item where i.order_id=(item->>'orderId')::uuid;
end;
$$;
revoke all on function public.edit_invoice_group(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.edit_invoice_group(uuid,jsonb) to service_role;
