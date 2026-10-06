import test from "node:test";
import assert from "node:assert/strict";

import { measurementSchema } from "../src/lib/validation.ts";
import { buildMeasurement, useQuoteStore } from "../src/store/quote-store.ts";

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

test("changing the selected address clears its previous lawn measurement", () => {
  const store = useQuoteStore.getState();
  const polygon = [
    { lat: 30.5, lng: -97.7 },
    { lat: 30.5, lng: -97.6995 },
    { lat: 30.5005, lng: -97.6995 },
  ];

  store.setAddress({ address: "123 Old Street", latitude: 30.5, longitude: -97.7 });
  store.setMeasurement(buildMeasurement(polygon, 1200));
  useQuoteStore.getState().setAddress({ address: "456 New Street", latitude: 30.51, longitude: -97.71 });

  assert.equal(useQuoteStore.getState().measurement, null);
  useQuoteStore.getState().reset();
});

test("setting the same address identity preserves its lawn measurement", () => {
  const polygon = [
    { lat: 30.5, lng: -97.7 },
    { lat: 30.5, lng: -97.6995 },
    { lat: 30.5005, lng: -97.6995 },
  ];
  const store = useQuoteStore.getState();

  store.setAddress({ address: "123 Old Street", placeId: "place-1", latitude: 30.5, longitude: -97.7 });
  store.setMeasurement(buildMeasurement(polygon, 1200));
  useQuoteStore.getState().setAddress({ address: "123 Old Street", placeId: "place-1", latitude: 30.5, longitude: -97.7 });

  assert.equal(useQuoteStore.getState().measurement?.areaSqFt, 1200);
  useQuoteStore.getState().reset();
});

test("changing only the selected place ID clears its lawn measurement", () => {
  const polygon = [
    { lat: 30.5, lng: -97.7 },
    { lat: 30.5, lng: -97.6995 },
    { lat: 30.5005, lng: -97.6995 },
  ];
  const store = useQuoteStore.getState();

  store.setAddress({ address: "123 Old Street", placeId: "place-1", latitude: 30.5, longitude: -97.7 });
  store.setMeasurement(buildMeasurement(polygon, 1200));
  useQuoteStore.getState().setAddress({ placeId: "place-2" });

  assert.equal(useQuoteStore.getState().measurement, null);
  useQuoteStore.getState().reset();
});
