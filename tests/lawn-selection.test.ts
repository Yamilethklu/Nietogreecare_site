import test from 'node:test';
import assert from 'node:assert/strict';
import * as turf from '@turf/turf';
import { selectLawnArea } from '../src/lib/lawn-selection';
import { solarMaskFootprint } from '../src/lib/solar-footprint';
import { writeArrayBuffer } from 'geotiff';
import proj4 from 'proj4';

test('front and back partition the entire lawn, exclude the house, and follow the road',()=>{
 const parcel=turf.bboxPolygon([-97.801,30.5,-97.8,30.501]);
 const house=turf.bboxPolygon([-97.8007,30.5003,-97.8003,30.5007]);
 const lawn=turf.difference(turf.featureCollection([parcel,house]))!;
 for(const road of [{lng:-97.8005,lat:30.499},{lng:-97.8005,lat:30.502},{lng:-97.802,lat:30.5005}]){
  const front=selectLawnArea(lawn,house,road,'front_only')!,back=selectLawnArea(lawn,house,road,'back_only')!;
  assert.ok(front&&back);
  assert.ok(Math.abs(turf.area(front)+turf.area(back)-turf.area(lawn))<0.1);
  assert.equal(turf.intersect(turf.featureCollection([front,house])),null);
  assert.equal(turf.intersect(turf.featureCollection([back,house])),null);
  assert.ok(turf.distance(turf.center(front),turf.point([road.lng,road.lat]))<turf.distance(turf.center(back),turf.point([road.lng,road.lat])));
 }
 assert.equal(selectLawnArea(lawn,house,null,'front_only'),null);
 assert.deepEqual(selectLawnArea(lawn,house,null,'front_back'),lawn);
});

test('Solar roof mask is georeferenced and clipped instead of replaced by a rectangle',async()=>{
 const projection='+proj=utm +zone=14 +datum=WGS84 +units=m +no_defs';
 const origin=proj4('EPSG:4326',projection,[-97.8,30.5]);
 const values=Array.from({length:64},(_,i)=>{const x=i%8,y=Math.floor(i/8);return x>=2&&x<6&&y>=2&&y<6?1:0;});
 const buffer=writeArrayBuffer(values,{width:8,height:8,ModelPixelScale:[1,1,0],ModelTiepoint:[0,0,0,origin[0],origin[1],0],ProjectedCSTypeGeoKey:32614,GTModelTypeGeoKey:1,GeogCitationGeoKey:'WGS 84'});
 const original=globalThis.fetch;
 globalThis.fetch=async(input)=>String(input).includes('dataLayers:')?Response.json({maskUrl:'https://solar.googleapis.com/v1/geoTiff:test'}):new Response(buffer);
 try{
  const footprint=await solarMaskFootprint(30.5,-97.8,'test',turf.bboxPolygon([-97.8002,30.4998,-97.7998,30.5002]));
  assert.ok(footprint);
  assert.ok(turf.area(footprint)>10&&turf.area(footprint)<20);
 }finally{globalThis.fetch=original;}
});

test('Solar affine transformation preserves the negative row direction',async()=>{
 const projection='+proj=utm +zone=14 +datum=WGS84 +units=m +no_defs';
 const origin=proj4('EPSG:4326',projection,[-97.8,30.5]);
 const values=Array.from({length:64},(_,i)=>{const x=i%8,y=Math.floor(i/8);return x>=2&&x<6&&y>=2&&y<6?1:0;});
 const buffer=writeArrayBuffer(values,{width:8,height:8,ModelTransformation:[1,0,0,origin[0],0,-1,0,origin[1],0,0,1,0,0,0,0,1],ProjectedCSTypeGeoKey:32614,GTModelTypeGeoKey:1,GeogCitationGeoKey:'WGS 84'});
 const original=globalThis.fetch;
 globalThis.fetch=async(input)=>String(input).includes('dataLayers:')?Response.json({maskUrl:'https://solar.googleapis.com/v1/geoTiff:test'}):new Response(buffer);
 try{
  const footprint=await solarMaskFootprint(30.5,-97.8,'test',turf.bboxPolygon([-97.8002,30.4998,-97.7998,30.5002]));
  assert.ok(footprint);
  assert.ok(turf.center(footprint).geometry.coordinates[1] < 30.5);
  assert.ok(turf.area(footprint)>10&&turf.area(footprint)<20);
 }finally{globalThis.fetch=original;}
});
