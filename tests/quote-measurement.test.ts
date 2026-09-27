import test from "node:test";
import assert from "node:assert/strict";

import { measurementSchema } from "../src/lib/validation.ts";
import { buildMeasurement } from "../src/store/quote-store.ts";

test("buildMeasurement preserves parcel polygons for satellite rendering", () => {
  const selectedPolygon = [
    { lat: 30.5, lng: -97.7 },
    { lat: 30.5, lng: -97.6995 },
    { lat: 30.5005, lng: -97.6995 },
    { lat: 30.5005, lng: -97.7 },
  ];
  const parcelPolygons = [[
    { lat: 30.4998, lng: -97.7002 },
    { lat: 30.4998, lng: -97.6992 },
    { lat: 30.5008, lng: -97.6992 },
    { lat: 30.5008, lng: -97.7002 },
  ]];

  const measurement = buildMeasurement(selectedPolygon, 1200, 2, 19, [selectedPolygon], parcelPolygons);

  assert.deepEqual(measurement.parcelPolygons, parcelPolygons);
  assert.equal(measurement.areaSqFt, 1200);
});

test("measurementSchema accepts optional parcel polygons", () => {
  const parsed = measurementSchema.parse({
    areaSqFt: 1200,
    areaSqYd: 133.33,
    estimatedCubicYards: 7.41,
    depthInches: 2,
    perimeterFt: 140,
    polygon: [
      { lat: 30.5, lng: -97.7 },
      { lat: 30.5, lng: -97.6995 },
      { lat: 30.5005, lng: -97.6995 },
    ],
    polygons: [[
      { lat: 30.5, lng: -97.7 },
      { lat: 30.5, lng: -97.6995 },
      { lat: 30.5005, lng: -97.6995 },
    ]],
    parcelPolygons: [[
      { lat: 30.4998, lng: -97.7002 },
      { lat: 30.4998, lng: -97.6992 },
      { lat: 30.5008, lng: -97.6992 },
    ]],
    polygonPath: null,
    bounds: null,
    center: null,
    zoom: 19,
  });

  assert.equal(parsed.parcelPolygons?.length, 1);
});
