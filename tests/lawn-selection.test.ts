import test from 'node:test';
import assert from 'node:assert/strict';
import * as turf from '@turf/turf';
import { selectLawnArea } from '../src/lib/lawn-selection';
import { solarMaskFootprint } from '../src/lib/solar-footprint';
import { writeArrayBuffer } from 'geotiff';
import proj4 from 'proj4';
import { asAreaFeature, type AreaFeature } from '../src/lib/parcel-geometry';

const TEST_LATITUDE=30.5;
const TEST_LONGITUDE=-97.8;
const METERS_PER_DEGREE_LONGITUDE=111320*Math.cos(TEST_LATITUDE*Math.PI/180);

function coordinate(x:number,y:number):[number,number]{
 return [TEST_LONGITUDE+x/METERS_PER_DEGREE_LONGITUDE,TEST_LATITUDE+y/110540];
}

function rectangle(x1:number,y1:number,x2:number,y2:number){
 const [west,south]=coordinate(x1,y1),[east,north]=coordinate(x2,y2);
 return turf.bboxPolygon([west,south,east,north]);
}

function assertBalancedFront(lawn:AreaFeature,house:AreaFeature,road=coordinate(-5,10)){
 const front=selectLawnArea(lawn,house,{lng:road[0],lat:road[1]},'front_only');
 const back=selectLawnArea(lawn,house,{lng:road[0],lat:road[1]},'back_only');
 assert.ok(front&&back);
 assert.ok(Math.abs(turf.area(front)/turf.area(lawn)-0.5)<=0.1,`front share was ${turf.area(front)/turf.area(lawn)}`);
 assert.ok(Math.abs(turf.area(front)+turf.area(back)-turf.area(lawn))<0.1);
}

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

test('front/back split is balanced when the house is centered',()=>{
 const parcel=rectangle(0,0,15,20);
 const house=asAreaFeature(rectangle(3.5,5,11.5,15))!;
 const lawn=asAreaFeature(turf.difference(turf.featureCollection([parcel,house])))!;
 assertBalancedFront(lawn,house);
});

test('front/back split is balanced when the house is close to the street',()=>{
 const parcel=rectangle(0,0,15,20);
 const house=asAreaFeature(rectangle(0.5,5,8.5,15))!;
 const lawn=asAreaFeature(turf.difference(turf.featureCollection([parcel,house])))!;
 assertBalancedFront(lawn,house);
});

test('front/back split is balanced when the house is at the back of the parcel',()=>{
 const parcel=rectangle(0,0,15,20);
 const house=asAreaFeature(rectangle(10,5,15,15))!;
 const lawn=asAreaFeature(turf.difference(turf.featureCollection([parcel,house])))!;
 assertBalancedFront(lawn,house);
});

test('front/back split remains balanced when the road is on the opposite side',()=>{
 const parcel=rectangle(0,0,15,20);
 const house=asAreaFeature(rectangle(3.5,5,11.5,15))!;
 const lawn=asAreaFeature(turf.difference(turf.featureCollection([parcel,house])))!;
 assertBalancedFront(lawn,house,coordinate(20,10));
});

test('front/back split preserves full selection and rejects a coincident road point',()=>{
 const parcel=rectangle(0,0,15,20);
 const house=asAreaFeature(rectangle(3.5,5,11.5,15))!;
 const lawn=asAreaFeature(turf.difference(turf.featureCollection([parcel,house])))!;
 const center=turf.center(house).geometry.coordinates;

 assert.deepEqual(selectLawnArea(lawn,house,null,'front_back'),lawn);
 assert.equal(selectLawnArea(lawn,house,{lng:center[0],lat:center[1]},'front_only'),null);
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
