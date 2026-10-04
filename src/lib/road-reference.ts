import * as turf from '@turf/turf';
import type { FeatureCollection, LineString, MultiLineString } from 'geojson';
import type { AreaFeature } from './parcel-geometry';

const normalizeStreet = (value:string) => value.toLowerCase().replace(/\b(street|st|road|rd|drive|dr|lane|ln|court|ct|boulevard|blvd|avenue|ave|way|circle|cir)\b/g,'').replace(/[^a-z0-9]/g,'');

export function selectRoadReference(data:FeatureCollection<LineString|MultiLineString>,parcel:AreaFeature,address:string) {
 const center=turf.center(parcel);
 const street=normalizeStreet(address.split(',')[0].replace(/^\d+\s*/,''));
 let nearest:{lat:number;lng:number;distance:number;matches:boolean}|null=null;
 for(const feature of data.features??[]){
  if(!feature.geometry||!['LineString','MultiLineString'].includes(feature.geometry.type))continue;
  try{
   const point=turf.nearestPointOnLine(feature,center,{units:'meters'});
   const distance=Number(point.properties.dist);
   if(!Number.isFinite(distance)||distance>150)continue;
   const matches=Boolean(street&&normalizeStreet(String(feature.properties?.NAME??''))===street);
   if(!nearest||(matches&&!nearest.matches)||(matches===nearest.matches&&distance<nearest.distance))nearest={lat:point.geometry.coordinates[1],lng:point.geometry.coordinates[0],distance,matches};
  }catch{/* Ignore malformed line features. */}
 }
 return nearest?{lat:nearest.lat,lng:nearest.lng}:null;
}

/** Public Census street centerlines supply a road reference when Overpass is unavailable. */
export async function getCensusRoadPoint(lat:number,lng:number,parcel:AreaFeature,address:string){
 try{
  const dy=150/111320,dx=dy/Math.cos(lat*Math.PI/180);
  const url=new URL('https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer/8/query');
  url.search=new URLSearchParams({geometry:`${lng-dx},${lat-dy},${lng+dx},${lat+dy}`,geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'NAME',returnGeometry:'true',f:'geojson'}).toString();
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok)return null;
  const data=await response.json();
  if(data.type!=='FeatureCollection'||!Array.isArray(data.features))return null;
  return selectRoadReference(data,parcel,address);
 }catch{return null;}
}
