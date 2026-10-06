import test from "node:test";
import assert from "node:assert/strict";
import * as turf from "@turf/turf";

import { featureAreaSqFt, findAreaFeature, subtractFootprint, subtractSidewalkStrip } from "../src/lib/parcel-geometry.ts";

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
