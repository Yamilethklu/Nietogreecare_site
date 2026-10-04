-- Recurrence is generated in the same transaction as the accepted quote.
alter table public.leads add column if not exists quote_options jsonb not null default '{}'::jsonb;

create or replace function public.refresh_recurring_visits(p_plan_id uuid default null)
returns integer language plpgsql security invoker set search_path='' as $$
declare inserted integer;
begin
  insert into public.work_orders(plan_id,lead_id,crew_member_id,service_date,start_time,duration_minutes,status,price,notes)
  select p.id,p.lead_id,p.crew_member_id,d::date,p.preferred_start,p.duration_minutes,'scheduled',p.price_per_visit,p.notes
  from public.service_plans p
  cross join lateral generate_series(p.first_date::timestamp,
    case when p.cadence='one_time' then p.first_date else greatest(p.first_date, (now() at time zone 'America/Chicago')::date+84) end::timestamp,
    case when p.cadence='weekly' then interval '7 days' else interval '14 days' end) d
  where p.active and (p_plan_id is null or p.id=p_plan_id)
  on conflict(plan_id,service_date) do nothing;
  get diagnostics inserted=row_count;
  return inserted;
end;
$$;
revoke all on function public.refresh_recurring_visits(uuid) from public,anon,authenticated;
grant execute on function public.refresh_recurring_visits(uuid) to service_role;

create or replace function public.schedule_lawn_quote()
returns trigger language plpgsql security invoker set search_path='' as $$
declare plan_id uuid; frequency text;
begin
 if not (new.selected_services @> '["weekly_biweekly_lawn_service"]'::jsonb)
    or new.requested_date is null or new.final_price is null or new.status='cancelled' then return new; end if;
 frequency:=new.quote_options->>'mowFrequency';
 if new.quote_options->>'serviceFrequency'='one_time' or new.details like '%Frecuencia: One-time%' then frequency:='one_time';
 elsif frequency is null then
   if new.details like '%Corte: Bi-Weekly%' then frequency:='bi_weekly';
   elsif new.details like '%Corte: Weekly%' then frequency:='weekly';
   else return new; end if;
 end if;
 if frequency not in ('weekly','bi_weekly','one_time') then raise exception 'Invalid cadence'; end if;
 insert into public.service_plans(lead_id,cadence,first_date,preferred_start,duration_minutes,price_per_visit,notes)
 values(new.id,frequency,new.requested_date,'08:00',60,new.final_price,new.details)
 returning id into plan_id;
 perform public.refresh_recurring_visits(plan_id);
 return new;
end;
$$;
revoke all on function public.schedule_lawn_quote() from public,anon,authenticated;
drop trigger if exists schedule_lawn_quote on public.leads;
create trigger schedule_lawn_quote after insert on public.leads for each row execute function public.schedule_lawn_quote();

-- Group payments lock rows and only change accounting fields, preserving assignments/status.
create or replace function public.pay_invoice_group(p_invoice_id uuid,p_method text)
returns void language plpgsql security invoker set search_path='' as $$
declare invoice_number text; group_key text;
begin
 if p_method not in ('cash','cash_app','venmo','zelle','check','other') then raise exception 'Invalid payment method'; end if;
 select i.invoice_number into strict invoice_number from public.work_invoices i where i.id=p_invoice_id;
 group_key:=case when invoice_number like 'NGC-G-%/%' then split_part(invoice_number,'/',1) else invoice_number end;
 perform 1 from public.work_invoices i join public.work_orders o on o.id=i.order_id
 where i.invoice_number=group_key or i.invoice_number like group_key||'/%' order by o.id for update of i,o;
 if exists(select 1 from public.work_invoices i join public.work_orders o on o.id=i.order_id
 where (i.invoice_number=group_key or i.invoice_number like group_key||'/%') and (o.status<>'completed' or o.paid_amount>i.total)) then raise exception 'Review completed visits and prior payments'; end if;
 update public.work_orders o set price=i.total,paid_amount=i.total,payment_method=p_method,paid_at=now()
 from public.work_invoices i where o.id=i.order_id and (i.invoice_number=group_key or i.invoice_number like group_key||'/%') and o.paid_amount<i.total;
end;
$$;
revoke all on function public.pay_invoice_group(uuid,text) from public,anon,authenticated;
grant execute on function public.pay_invoice_group(uuid,text) to service_role;

create extension if not exists pg_cron;
do $$begin
 if not exists(select 1 from cron.job where jobname='nieto-recurring-visits') then
  perform cron.schedule('nieto-recurring-visits','15 6 * * *','select public.refresh_recurring_visits()');
 end if;
end$$;
