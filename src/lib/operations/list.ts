import type { OpsDB } from './server';

export async function listAll(db:OpsDB,table:string,columns='*',sort='created_at'){
 const rows:Record<string,any>[]=[];
 for(let offset=0;;offset+=500){
  const {data,error}=await db.from(table).select(columns).order(sort,{ascending:false}).order('id').range(offset,offset+499);
  if(error)return {data:null,error};
  rows.push(...(data??[]) as unknown as Record<string,any>[]);
  if(!data||data.length<500)return {data:rows,error:null};
 }
}
