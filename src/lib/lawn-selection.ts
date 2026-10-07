import * as turf from '@turf/turf';
import { asAreaFeature, type AreaFeature } from './parcel-geometry';

const AREA_BALANCE_RELATIVE_TOLERANCE=0.005;
const MAX_AREA_SPLIT_ITERATIONS=32;
const MIN_ROAD_HOUSE_DISTANCE_METERS=0.01;

function projectAlongAxis(origin:number[],axisBearing:number,coordinate:number[]){
 const point=turf.point(coordinate);
 const originPoint=turf.point(origin);
 const distance=turf.distance(originPoint,point,{units:'meters'});
 const bearingOffset=((turf.bearing(originPoint,point)-axisBearing+540)%360)-180;
 const angle=bearingOffset*Math.PI/180;
 return {
  forward:distance*Math.cos(angle),
  perpendicular:distance*Math.sin(angle),
 };
}

function createFrontHalfPlane(
 origin:number[],
 axisBearing:number,
 cutoff:number,
 frontMinimum:number,
 perpendicularLimit:number,
){
 const toCoordinate=(forward:number,perpendicular:number)=>turf.destination(
  turf.point(origin),
  Math.hypot(forward,perpendicular),
  axisBearing+Math.atan2(perpendicular,forward)*180/Math.PI,
  {units:'meters'},
 ).geometry.coordinates;
 return turf.polygon([[
  toCoordinate(frontMinimum,-perpendicularLimit),
  toCoordinate(cutoff,-perpendicularLimit),
  toCoordinate(cutoff,perpendicularLimit),
  toCoordinate(frontMinimum,perpendicularLimit),
  toCoordinate(frontMinimum,-perpendicularLimit),
 ]]);
}

export function selectLawnArea(lawn:AreaFeature,house:AreaFeature,road:{lat:number;lng:number}|null,selection:'front_back'|'front_only'|'back_only'):AreaFeature|null {
 if(selection==='front_back')return lawn;
 if(!road)return null;

 const houseCenter=turf.center(house).geometry.coordinates;
 const origin=turf.point(houseCenter);
 const roadPoint=turf.point([road.lng,road.lat]);
 if(turf.distance(roadPoint,origin,{units:'meters'})<MIN_ROAD_HOUSE_DISTANCE_METERS)return null;
 const axisBearing=turf.bearing(roadPoint,origin);

 const projections=turf.coordAll(lawn).map(coordinate=>projectAlongAxis(houseCenter,axisBearing,coordinate));
 if(!projections.length)return null;

 const minForward=Math.min(...projections.map(({forward})=>forward));
 const maxForward=Math.max(...projections.map(({forward})=>forward));
 const maxPerpendicular=Math.max(...projections.map(({perpendicular})=>Math.abs(perpendicular)));
 const span=Math.max(maxForward-minForward,maxPerpendicular*2,10);
 const areaTotal=turf.area(lawn);
 if(!Number.isFinite(areaTotal)||areaTotal<=0)return null;
 const areaTarget=areaTotal/2;
 const frontMinimum=minForward-span;
 let low=minForward;
 let high=maxForward;
 const perpendicularLimit=maxPerpendicular+span;
 let cutoff=(low+high)/2;
 let front:AreaFeature|null=null;
 let bestFront:AreaFeature|null=null;
 let bestAreaDifference=Infinity;

 for(let iteration=0;iteration<MAX_AREA_SPLIT_ITERATIONS;iteration++){
  cutoff=(low+high)/2;
  front=asAreaFeature(turf.intersect(turf.featureCollection([
   lawn,
   createFrontHalfPlane(houseCenter,axisBearing,cutoff,frontMinimum,perpendicularLimit),
  ])));
  const frontArea=front?turf.area(front):0;
  const areaDifference=Math.abs(frontArea-areaTarget);
  if(front&&areaDifference<bestAreaDifference){
   bestFront=front;
   bestAreaDifference=areaDifference;
  }
  if(areaDifference<=areaTarget*AREA_BALANCE_RELATIVE_TOLERANCE){
   break;
  }
  if(frontArea<areaTarget)low=cutoff;
  else high=cutoff;
 }

 const selectedFront=bestFront??front;
 if(selection==='front_only')return selectedFront;
 if(!selectedFront)return turf.feature(lawn.geometry,lawn.properties) as AreaFeature;
 return asAreaFeature(turf.difference(turf.featureCollection([lawn,selectedFront])));
}
