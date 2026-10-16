import * as turf from '@turf/turf';
import { asAreaFeature, type AreaFeature } from './parcel-geometry';

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
 if(!Number.isFinite(turf.area(lawn))||turf.area(lawn)<=0)return null;
 // Corte geométrico exacto: el frente es todo el jardín entre la calle y el centro de la casa;
 // el fondo es el resto. Los patios laterales se reparten por la mitad de la casa.
 const frontMinimum=minForward-span;
 const perpendicularLimit=maxPerpendicular+span;
 const front=asAreaFeature(turf.intersect(turf.featureCollection([
  lawn,
  createFrontHalfPlane(houseCenter,axisBearing,0,frontMinimum,perpendicularLimit),
 ])));
 const selectedFront=front;
 if(selection==='front_only')return selectedFront;
 if(!selectedFront)return turf.feature(lawn.geometry,lawn.properties) as AreaFeature;
 return asAreaFeature(turf.difference(turf.featureCollection([lawn,selectedFront])));
}

