'use client';
import * as React from 'react';
import type { PricingRule } from '@/lib/types';

type Props = { rules: PricingRule[]; onCreated: (rule: PricingRule) => void; onUpdated: (rule: PricingRule) => void };
export function LawnRateEditor({rules,onCreated,onUpdated}: Props) {
 const [frequency,setFrequency]=React.useState<'weekly'|'bi_weekly'>('weekly');
 const [min,setMin]=React.useState(''); const [max,setMax]=React.useState(''); const [price,setPrice]=React.useState('');
 const [notice,setNotice]=React.useState(''); const [working,setWorking]=React.useState(false);
 const bands=rules.filter((r)=>r.service_key?.startsWith('lawn_'));
 async function save(url:string,method:'POST'|'PATCH',body:unknown,callback:(r:PricingRule)=>void) {setWorking(true);setNotice('');try {const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(!response.ok||!result.ok) throw new Error(result.error||'No se pudo guardar');callback(result.data);setNotice('Tarifa guardada. Ya está disponible en el cotizador.');}catch(e){setNotice(e instanceof Error?e.message:'Error al guardar');}finally{setWorking(false);}}
 const add=()=>{const low=Number(min), high=max.trim()?Number(max):null, amount=Number(price);if(min.trim()===''||price.trim()===''||low<0||!Number.isFinite(low)||high!==null&&(!Number.isFinite(high)||high<=low)||!Number.isFinite(amount)||amount<=0){setNotice('Indique un rango válido y un precio mayor que cero.');return;}if(bands.some((r)=>r.is_active&&r.service_key===`lawn_${frequency}`&&low<Number(r.max_sq_ft??Infinity)&&(high??Infinity)>Number(r.min_sq_ft))){setNotice('El rango se superpone con otra tarifa activa.');return;}void save('/api/admin/pricing','POST',{name:`Césped ${min}–${max||'+'} ft² ${frequency}`,service_key:`lawn_${frequency}`,min_sq_ft:low,max_sq_ft:high,price:amount,is_active:true},onCreated);};
 return <section className="rounded-2xl border border-emerald-500 bg-emerald-100 p-5 text-slate-950"><h2 className="text-xl font-bold">Precios instantáneos por tamaño del césped</h2><p className="mt-2 text-sm text-slate-800">Configure aquí el precio semanal de la promoción y el precio quincenal para cada rango de césped. Si el semanal es menor, el resumen muestra el ahorro y permite cambiar a cada 7 días. No hay precios de ejemplo publicados. Rango mínimo inclusivo y máximo exclusivo. El cotizador solo acepta solicitudes cuando existe una tarifa para la medida.</p><div className="mt-4 grid gap-3 sm:grid-cols-5"><label>Frecuencia<select className="mt-1 w-full rounded-lg bg-white p-2 text-slate-900" value={frequency} onChange={e=>setFrequency(e.target.value as typeof frequency)}><option value="weekly">Semanal</option><option value="bi_weekly">Quincenal</option></select></label><label>Desde (ft²)<input className="mt-1 w-full rounded-lg bg-white p-2 text-slate-900" type="number" min="0" value={min} onChange={e=>setMin(e.target.value)} /></label><label>Hasta (ft²)<input className="mt-1 w-full rounded-lg bg-white p-2 text-slate-900" type="number" min="0" placeholder="Sin límite" value={max} onChange={e=>setMax(e.target.value)} /></label><label>USD / corte<input className="mt-1 w-full rounded-lg bg-white p-2 text-slate-900" type="number" min="0.01" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} /></label><button className="self-end rounded-lg bg-lime-500 px-3 py-2 font-bold text-slate-950 disabled:opacity-50" disabled={working} onClick={add}>Agregar rango</button></div>{notice&&<p role="status" className="mt-3 text-sm text-emerald-900">{notice}</p>}<div className="mt-5 space-y-2">{bands.map((r)=><Band key={r.id} rule={r} working={working} save={(changes)=>void save('/api/admin/pricing','PATCH',{id:r.id,changes},onUpdated)} />)}{!bands.length&&<p className="text-sm text-emerald-900">Sin rangos configurados. Agregue los precios reales antes de ofrecer cotizaciones instantáneas.</p>}</div></section>;
}
function Band({rule,save,working}:{rule:PricingRule;save:(change:Record<string,unknown>)=>void;working:boolean}) {
 const [price,setPrice]=React.useState(String(rule.price));
 const [min,setMin]=React.useState(String(rule.min_sq_ft));
 const [max,setMax]=React.useState(rule.max_sq_ft == null ? '' : String(rule.max_sq_ft));
 const [error,setError]=React.useState('');
 React.useEffect(()=>{setPrice(String(rule.price));setMin(String(rule.min_sq_ft));setMax(rule.max_sq_ft==null?'':String(rule.max_sq_ft));},[rule.price,rule.min_sq_ft,rule.max_sq_ft]);
 const update=()=>{
  const low=Number(min),high=max.trim()?Number(max):null,amount=Number(price);
  if(!min.trim()||!price.trim()||!Number.isFinite(low)||low<0||!Number.isFinite(amount)||amount<=0||(high!==null&&(!Number.isFinite(high)||high<=low))){setError('Indique un rango válido y un precio mayor que cero.');return;}
  setError('');save({min_sq_ft:low,max_sq_ft:high,price:amount});
 };
 return <div className="rounded-lg border border-emerald-300 p-3 text-sm">
  <p className="mb-3 font-semibold">{rule.service_key==='lawn_weekly'?'Semanal · precio de la promoción':'Quincenal'} {rule.is_active?'':'· pausada'}</p>
  <div className="flex flex-wrap items-end gap-3">
   <label>Desde (ft²)<input aria-label="Desde ft²" className="mt-1 block w-28 rounded bg-white p-2 text-slate-900" type="number" min="0" value={min} onChange={e=>setMin(e.target.value)}/></label>
   <label>Hasta (ft²)<input aria-label="Hasta ft²" placeholder="Sin límite" className="mt-1 block w-28 rounded bg-white p-2 text-slate-900" type="number" min="0" value={max} onChange={e=>setMax(e.target.value)}/></label>
   <label>USD / corte<input aria-label="Precio por corte" className="mt-1 block w-28 rounded bg-white p-2 text-slate-900" type="number" min="0.01" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></label>
   <button disabled={working} className="rounded bg-lime-500 px-3 py-2 text-slate-950 disabled:opacity-50" onClick={update}>Guardar rango y precio</button>
   <button disabled={working} className="rounded border border-emerald-500 px-3 py-2" onClick={()=>save({is_active:!rule.is_active})}>{rule.is_active?'Pausar':'Activar'}</button>
  </div>{error&&<p role="alert" className="mt-2 text-red-700">{error}</p>}
 </div>;
}
