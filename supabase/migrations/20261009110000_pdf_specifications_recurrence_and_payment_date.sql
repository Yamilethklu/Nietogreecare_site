-- PDF requirements: support exact 8-day and 15-day recurrence and user-selected payment dates.
-- Legacy cadence values and existing secrets/configuration remain unchanged.
alter table public.service_plans drop constraint if exists service_plans_cadence_check;
alter table public.service_plans add constraint service_plans_cadence_check
  check (cadence in ('weekly','bi_weekly','every_8_days','every_15_days','one_time'));

create or replace function public.refresh_recurring_visits(p_plan_id uuid default null)
returns integer language plpgsql security invoker set search_path='' as $$
declare inserted integer;
begin
  insert into public.work_orders(plan_id,lead_id,crew_member_id,service_date,start_time,duration_minutes,status,price,notes)
  select p.id,p.lead_id,p.crew_member_id,d::date,p.preferred_start,p.duration_minutes,'scheduled',p.price_per_visit,p.notes
  from public.service_plans p
  cross join lateral generate_series(
    p.first_date::timestamp,
    case when p.cadence='one_time' then p.first_date
      else greatest(p.first_date, (now() at time zone 'America/Chicago')::date+84) end::timestamp,
    case p.cadence when 'weekly' then interval '7 days'
      when 'every_8_days' then interval '8 days'
      when 'every_15_days' then interval '15 days'
      else interval '14 days' end
  ) d
  where p.active and (p_plan_id is null or p.id=p_plan_id)
  on conflict(plan_id,service_date) do nothing;
  get diagnostics inserted=row_count;
  return inserted;
end;
$$;
revoke all on function public.refresh_recurring_visits(uuid) from public,anon,authenticated;
grant execute on function public.refresh_recurring_visits(uuid) to service_role;

create or replace function public.save_mobile_house(p_id uuid,p_house jsonb,p_cadence text,p_date date,p_price numeric,p_notes text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_lead uuid; v_plan public.service_plans; v_plan_id uuid; v_today date := (now() at time zone 'America/Chicago')::date;
begin
 if p_cadence not in ('weekly','bi_weekly','every_8_days','every_15_days','one_time') or p_price<0 or p_price>100000 or p_date is null then raise exception 'Invalid plan'; end if;
 if p_id is null then
  if p_date<v_today then raise exception 'Select today or a future date'; end if;
  insert into public.leads(customer_name,customer_phone,customer_email,address,city,zip_code,reference_code,source,selected_services,service_count,requested_date,final_price,additional_notes)
  values(p_house->>'customer_name',p_house->>'customer_phone',p_house->>'customer_email',p_house->>'address',p_house->>'city',p_house->>'zip_code','APP-'||gen_random_uuid()::text,'mobile_app','["weekly_biweekly_lawn_service"]'::jsonb,1,p_date,p_price,p_notes)
  returning id into v_lead;
 else
  select id into strict v_lead from public.leads where id=p_id for update;
  update public.leads set customer_name=p_house->>'customer_name',customer_phone=p_house->>'customer_phone',customer_email=p_house->>'customer_email',address=p_house->>'address',city=p_house->>'city',zip_code=p_house->>'zip_code',final_price=p_price,additional_notes=p_notes where id=v_lead;
 end if;
 select * into v_plan from public.service_plans where lead_id=v_lead order by active desc,created_at desc limit 1 for update;
 if v_plan.id is not null and v_plan.cadence<>p_cadence then
  if p_date<v_today then raise exception 'Select today or a future date'; end if;
  if exists(select 1 from public.work_orders o where o.plan_id=v_plan.id and o.service_date>=v_today and (o.status in ('in_progress','completed') or o.paid_amount>0 or exists(select 1 from public.work_invoices i where i.order_id=o.id))) then raise exception 'Review future visits with payments or invoices before changing frequency'; end if;
  update public.service_plans set active=false where id=v_plan.id;
  update public.work_orders o set status='cancelled' where o.plan_id=v_plan.id and o.service_date>=v_today and o.status='scheduled' and o.paid_amount=0 and not exists(select 1 from public.work_invoices i where i.order_id=o.id);
  v_plan_id:=null;
 else v_plan_id:=v_plan.id;
 end if;
 if v_plan_id is null then
  insert into public.service_plans(lead_id,crew_member_id,cadence,first_date,preferred_start,duration_minutes,price_per_visit,notes)
  values(v_lead,v_plan.crew_member_id,p_cadence,p_date,coalesce(v_plan.preferred_start,'08:00'::time),coalesce(v_plan.duration_minutes,60),p_price,p_notes) returning id into v_plan_id;
 else
  update public.service_plans set price_per_visit=p_price,notes=p_notes where id=v_plan_id;
  update public.work_orders o set price=p_price,notes=p_notes where o.plan_id=v_plan_id and o.service_date>=v_today and o.status='scheduled' and o.paid_amount=0 and not exists(select 1 from public.work_invoices i where i.order_id=o.id);
 end if;
 perform public.refresh_recurring_visits(v_plan_id);
 return jsonb_build_object('id',v_lead,'planId',v_plan_id);
end;
$$;
revoke all on function public.save_mobile_house(uuid,jsonb,text,date,numeric,text) from public,anon,authenticated;
grant execute on function public.save_mobile_house(uuid,jsonb,text,date,numeric,text) to service_role;

create or replace function public.schedule_lawn_quote()
returns trigger language plpgsql security invoker set search_path='' as $$
declare plan_id uuid; frequency text;
begin
 if not (new.selected_services @> '["weekly_biweekly_lawn_service"]'::jsonb)
    or new.requested_date is null or new.final_price is null or new.status='cancelled' then return new; end if;
 frequency:=new.quote_options->>'mowFrequency';
 if new.quote_options->>'serviceFrequency'='one_time' or new.details like '%Frecuencia: One-time%' then frequency:='one_time';
 elsif frequency is null then
   if new.details like '%Corte: Every 8 days%' then frequency:='every_8_days';
   elsif new.details like '%Corte: Every 15 days%' then frequency:='every_15_days';
   elsif new.details like '%Corte: Bi-Weekly%' then frequency:='bi_weekly';
   elsif new.details like '%Corte: Weekly%' then frequency:='weekly';
   else return new; end if;
 end if;
 if frequency not in ('weekly','bi_weekly','every_8_days','every_15_days','one_time') then raise exception 'Invalid cadence'; end if;
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

create or replace function public.pay_invoice_group(p_invoice_id uuid,p_method text,p_payment_date date)
returns void language plpgsql security invoker set search_path='' as $$
declare invoice_number text; group_key text; v_paid_at timestamptz;
begin
 if p_method not in ('cash','cash_app','venmo','zelle','check','other') then raise exception 'Invalid payment method'; end if;
 if p_payment_date is null or p_payment_date > (now() at time zone 'America/Chicago')::date then raise exception 'Invalid payment date'; end if;
 v_paid_at := p_payment_date::timestamp at time zone 'America/Chicago';
 select i.invoice_number into strict invoice_number from public.work_invoices i where i.id=p_invoice_id;
 group_key:=case when invoice_number like 'NGC-G-%/%' then split_part(invoice_number,'/',1) else invoice_number end;
 perform 1 from public.work_invoices i join public.work_orders o on o.id=i.order_id
 where i.invoice_number=group_key or i.invoice_number like group_key||'/%' order by o.id for update of i,o;
 if exists(select 1 from public.work_invoices i join public.work_orders o on o.id=i.order_id
 where (i.invoice_number=group_key or i.invoice_number like group_key||'/%') and (o.status<>'completed' or o.paid_amount>i.total)) then raise exception 'Review completed visits and prior payments'; end if;
 update public.work_orders o set price=i.total,paid_amount=i.total,payment_method=p_method,paid_at=v_paid_at
 from public.work_invoices i where o.id=i.order_id and (i.invoice_number=group_key or i.invoice_number like group_key||'/%') and o.paid_amount<i.total;
end;
$$;
revoke all on function public.pay_invoice_group(uuid,text,date) from public,anon,authenticated;
grant execute on function public.pay_invoice_group(uuid,text,date) to service_role;
