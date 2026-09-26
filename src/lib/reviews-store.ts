import { getSupabaseAdminClient } from '@/lib/supabase/admin';
export type CustomerReview={id:string;customer_name:string;city:string;rating:number;comment:string;approved:boolean;created_at:string};
const KEY='customer_reviews';
export async function readReviews():Promise<CustomerReview[]> {
 const db=getSupabaseAdminClient();if(!db)throw new Error('Base de datos no disponible');
 const {data,error}=await db.from('app_settings').select('value').eq('key',KEY).maybeSingle();
 if(error)throw error;
 const items=(data?.value as {items?:CustomerReview[]}|null)?.items;
 return Array.isArray(items)?items:[];
}
export async function writeReviews(items:CustomerReview[]) {
 const db=getSupabaseAdminClient();if(!db)throw new Error('Base de datos no disponible');
 const {error}=await db.from('app_settings').upsert({key:KEY,value:{items:items.slice(0,200)},updated_at:new Date().toISOString()},{onConflict:'key'});
 if(error)throw error;
}
