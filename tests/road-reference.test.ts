import test from 'node:test';
import assert from 'node:assert/strict';
import * as turf from '@turf/turf';
import {selectRoadReference} from '../src/lib/road-reference';
const parcel=turf.bboxPolygon([-97.8001,30.5,-97.7999,30.5002]);
test('front reference prioritizes the address street over a closer neighboring street',()=>{
 const data=turf.featureCollection([
  turf.lineString([[-97.8002,30.499],[-97.8002,30.501]],{NAME:'Other St'}),
  turf.lineString([[-97.7996,30.499],[-97.7996,30.501]],{NAME:'Canis Street'}),
 ]);
 const road=selectRoadReference(data,parcel,'204 Canis St, Georgetown');
 assert.ok(road);assert.ok(Math.abs(road.lng+97.7996)<0.000001);
});
test('faraway roads never set a property front',()=>{
 assert.equal(selectRoadReference(turf.featureCollection([turf.lineString([[-98,30],[-98,30.1]],{NAME:'Canis St'})]),parcel,'204 Canis St'),null);
});
