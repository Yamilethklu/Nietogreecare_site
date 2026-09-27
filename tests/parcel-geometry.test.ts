import test from "node:test";
import assert from "node:assert/strict";

import { featureAreaSqFt, findAreaFeature, subtractFootprint } from "../src/lib/parcel-geometry.ts";

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
