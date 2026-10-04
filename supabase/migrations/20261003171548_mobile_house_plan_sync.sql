-- Atomic mobile edits preserve completed, paid and invoiced visits.
create or replace function public.save_mobile_house(p_id uuid,p_house jsonb,p_cadence text,p_date date,p_price numeric,p_notes text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_lead uuid; v_plan public.service_plans; v_plan_id uuid; v_today date := (now() at time zone 'America/Chicago')::date;
begin
 if p_cadence not in ('weekly','bi_weekly','one_time') or p_price<0 or p_price>100000 or p_date is null then raise exception 'Invalid plan'; end if;
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
