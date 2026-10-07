import test from "node:test";
import assert from "node:assert/strict";
import * as turf from "@turf/turf";

import { asAreaFeature, featureAreaSqFt, featureAreaSqM, findAreaFeature, subtractFootprint, subtractSidewalkStrip, type AreaFeature } from "../src/lib/parcel-geometry.ts";

const TEST_LATITUDE = 30.5;
const TEST_LONGITUDE = -97.8;
const METERS_PER_DEGREE_LONGITUDE = 111320 * Math.cos((TEST_LATITUDE * Math.PI) / 180);

function testCoordinate(x: number, y: number): [number, number] {
  return [
    TEST_LONGITUDE + x / METERS_PER_DEGREE_LONGITUDE,
    TEST_LATITUDE + y / 110540,
  ];
}

function testRectangle(width: number, depth: number) {
  const [west, south] = testCoordinate(0, 0);
  const [east, north] = testCoordinate(depth, width);
  return findAreaFeature(turf.bboxPolygon([west, south, east, north]))!;
}

function testHouse(frontGap: number, depth: number, width: number) {
  const startX = 15 - frontGap - depth;
  const south = (20 - width) / 2;
  const [west, bottom] = testCoordinate(startX, south);
  const [east, top] = testCoordinate(startX + depth, south + width);
  return findAreaFeature(turf.bboxPolygon([west, bottom, east, top]))!;
}

function sidewalkRemovedGeometry(lawn: AreaFeature, clipped: AreaFeature): AreaFeature | null {
  return asAreaFeature(turf.difference(turf.featureCollection([lawn, clipped])));
}

function sidewalkRemovedArea(lawn: AreaFeature, clipped: AreaFeature) {
  const removed = sidewalkRemovedGeometry(lawn, clipped);
  return removed ? featureAreaSqM(removed) : 0;
}

test("findAreaFeature returns the first polygon from geojson feature collections", () => {
  const feature = findAreaFeature({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [[
            [-97.7, 30.5],
            [-97.699, 30.5],
            [-97.699, 30.501],
            [-97.7, 30.501],
            [-97.7, 30.5],
          ]],
        },
        properties: {},
      },
    ],
  });

  assert.equal(feature?.geometry.type, "Polygon");
});

test("subtractFootprint removes the building footprint from the parcel area", () => {
  const parcel = findAreaFeature({
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [-97.7, 30.5],
        [-97.699, 30.5],
        [-97.699, 30.501],
        [-97.7, 30.501],
        [-97.7, 30.5],
      ]],
    },
    properties: {},
  });
  const building = findAreaFeature({
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [-97.6998, 30.5002],
        [-97.6992, 30.5002],
        [-97.6992, 30.5008],
        [-97.6998, 30.5008],
        [-97.6998, 30.5002],
      ]],
    },
    properties: {},
  });

  assert.ok(parcel);
  assert.ok(building);

  const usable = subtractFootprint(parcel, building);

  assert.ok(usable);
  assert.equal(usable.geometry.type, "Polygon");
  assert.ok(featureAreaSqFt(usable) < featureAreaSqFt(parcel));
});

test("subtractFootprint preserves multipolygon results when the footprint splits the parcel", () => {
  const parcel = findAreaFeature({
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [-97.7, 30.5],
        [-97.698, 30.5],
        [-97.698, 30.501],
        [-97.7, 30.501],
        [-97.7, 30.5],
      ]],
    },
    properties: {},
  });
  const building = findAreaFeature({
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [-97.6992, 30.5],
        [-97.6988, 30.5],
        [-97.6988, 30.501],
        [-97.6992, 30.501],
        [-97.6992, 30.5],
      ]],
    },
    properties: {},
  });

  assert.ok(parcel);
  assert.ok(building);

  const usable = subtractFootprint(parcel, building);

  assert.ok(usable);
  assert.equal(usable.geometry.type, "MultiPolygon");
});

test("subtractFootprint keeps the parcel unchanged when the building is outside it", () => {
  const parcel = findAreaFeature({
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [-97.7, 30.5],
        [-97.699, 30.5],
        [-97.699, 30.501],
        [-97.7, 30.501],
        [-97.7, 30.5],
      ]],
    },
    properties: {},
  });
  const building = findAreaFeature({
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [-97.6985, 30.5015],
        [-97.698, 30.5015],
        [-97.698, 30.502],
        [-97.6985, 30.502],
        [-97.6985, 30.5015],
      ]],
    },
    properties: {},
  });

  assert.ok(parcel);
  assert.ok(building);

  const usable = subtractFootprint(parcel, building);

  assert.ok(usable);
  assert.equal(usable.geometry.type, "Polygon");
  assert.equal(featureAreaSqFt(usable), featureAreaSqFt(parcel));
});

test("subtractSidewalkStrip clips only the road-facing edge by the configured setback", () => {
  const parcel = findAreaFeature(turf.bboxPolygon([-97.701, 30.5, -97.699, 30.501]));
  const house = findAreaFeature(turf.bboxPolygon([-97.7007, 30.5003, -97.7003, 30.5007]));
  assert.ok(parcel);
  assert.ok(house);

  const fullLawn = subtractFootprint(parcel, house);
  assert.ok(fullLawn);
  const clipped = subtractSidewalkStrip(fullLawn, parcel, house, { lat: 30.5005, lng: -97.698 }, 2.4);
  assert.ok(clipped);

  const eastEdge = turf.point([-97.699, 30.5005]);
  const inSidewalk = turf.destination(eastEdge, 1, 270, { units: "meters" });
  const beyondSetback = turf.destination(eastEdge, 4, 270, { units: "meters" });
  const oppositeSide = turf.point([-97.7009, 30.5005]);

  assert.equal(turf.booleanPointInPolygon(inSidewalk, clipped), false);
  assert.equal(turf.booleanPointInPolygon(beyondSetback, clipped), true);
  assert.equal(turf.booleanPointInPolygon(oppositeSide, clipped), true);
  assert.ok(featureAreaSqFt(clipped) < featureAreaSqFt(fullLawn));
});

test("subtractSidewalkStrip uses the full 2.4m setback when the centered house leaves ample frontage", () => {
  const parcel = testRectangle(20, 15);
  const house = testHouse(3.5, 8, 10);
  const lawn = subtractFootprint(parcel, house);
  assert.ok(lawn);

  const clipped = subtractSidewalkStrip(lawn, parcel, house, { lat: TEST_LATITUDE, lng: testCoordinate(20, 10)[0] }, 2.4);
  assert.ok(clipped);
  assert.ok(Math.abs(sidewalkRemovedArea(lawn, clipped) - 2.4 * 20) < 2);
  assert.ok(featureAreaSqM(clipped) > 20);

  const removed = sidewalkRemovedGeometry(lawn, clipped);
  assert.ok(removed);
  assert.equal(turf.intersect(turf.featureCollection([removed, house])), null);
});

test("subtractSidewalkStrip limits the cut to 80% of a 2m frontage", () => {
  const parcel = testRectangle(20, 15);
  const house = testHouse(2, 8, 10);
  const lawn = subtractFootprint(parcel, house);
  assert.ok(lawn);

  const clipped = subtractSidewalkStrip(lawn, parcel, house, { lat: TEST_LATITUDE, lng: testCoordinate(20, 10)[0] }, 2.4);
  assert.ok(clipped);
  assert.ok(Math.abs(sidewalkRemovedArea(lawn, clipped) - 1.6 * 20) < 2);

  const remainingFront = turf.point(testCoordinate(13.2, 10));
  assert.equal(turf.booleanPointInPolygon(remainingFront, clipped), true);
  const removed = sidewalkRemovedGeometry(lawn, clipped);
  assert.ok(removed);
  assert.equal(turf.intersect(turf.featureCollection([removed, house])), null);
});

test("subtractSidewalkStrip preserves positive lawn when frontage is only 0.5m", () => {
  const parcel = testRectangle(20, 15);
  const house = testHouse(0.5, 8, 10);
  const lawn = subtractFootprint(parcel, house);
  assert.ok(lawn);

  const clipped = subtractSidewalkStrip(lawn, parcel, house, { lat: TEST_LATITUDE, lng: testCoordinate(20, 10)[0] }, 2.4);
  assert.ok(clipped);
  assert.ok(Math.abs(sidewalkRemovedArea(lawn, clipped) - 0.4 * 20) < 1);
  assert.ok(featureAreaSqM(clipped) > 0);
  assert.equal(turf.booleanPointInPolygon(turf.point(testCoordinate(14.55, 10)), clipped), true);
});

test("subtractSidewalkStrip follows the road-facing edge of an irregular trapezoid", () => {
  const parcel = findAreaFeature(turf.polygon([[
    testCoordinate(0, 0),
    testCoordinate(15, 0),
    testCoordinate(13, 20),
    testCoordinate(0, 20),
    testCoordinate(0, 0),
  ]]))!;
  const house = findAreaFeature(turf.bboxPolygon([
    testCoordinate(9, 7)[0],
    testCoordinate(9, 7)[1],
    testCoordinate(12, 13)[0],
    testCoordinate(12, 13)[1],
  ]))!;
  const lawn = subtractFootprint(parcel, house);
  assert.ok(lawn);

  const clipped = subtractSidewalkStrip(lawn, parcel, house, { lat: testCoordinate(25, 10)[1], lng: testCoordinate(25, 10)[0] }, 2.4);
  assert.ok(clipped);
  assert.ok(sidewalkRemovedArea(lawn, clipped) > 0);
  assert.equal(turf.booleanPointInPolygon(turf.point(testCoordinate(14, 5)), clipped), false);
  assert.equal(turf.booleanPointInPolygon(turf.point(testCoordinate(5, 10)), clipped), true);

  const removed = sidewalkRemovedGeometry(lawn, clipped);
  assert.ok(removed);
  assert.equal(turf.intersect(turf.featureCollection([removed, house])), null);
});
