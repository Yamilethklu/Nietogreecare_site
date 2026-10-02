import * as turf from '@turf/turf';
import { asAreaFeature, type AreaFeature } from './parcel-geometry';

export function selectLawnArea(lawn:AreaFeature,house:AreaFeature,road:{lat:number;lng:number}|null,selection:'front_back'|'front_only'|'back_only'):AreaFeature|null {
 if(selection==='front_back')return lawn;
 if(!road)return null;
 const center=turf.center(house).geometry.coordinates;
 const latitudeScale=Math.cos(center[1]*Math.PI/180);
 const dx=(road.lng-center[0])*latitudeScale,dy=road.lat-center[1],length=Math.hypot(dx,dy);
 if(length<1e-10)return null;
 const [west,south,east,north]=turf.bbox(lawn),span=Math.max((east-west)*latitudeScale,north-south)*4;
 const ux=dx/length,uy=dy/length,sign=selection==='front_only'?1:-1;
 const a=[center[0]-uy*span/latitudeScale,center[1]+ux*span];
 const b=[center[0]+uy*span/latitudeScale,center[1]-ux*span];
 const c=[b[0]+ux*span*sign/latitudeScale,b[1]+uy*span*sign];
 const d=[a[0]+ux*span*sign/latitudeScale,a[1]+uy*span*sign];
 return asAreaFeature(turf.intersect(turf.featureCollection([lawn,turf.polygon([[a,b,c,d,a]])])));
}
