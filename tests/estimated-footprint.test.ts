import test from "node:test";
import assert from "node:assert/strict";
import * as turf from "@turf/turf";

import { estimateHouseFootprint } from "../src/lib/estimated-footprint.ts";

test("estimated house footprint is bounded, positive, and clipped to the parcel", () => {
  const parcel = turf.polygon([[
    [-97.701, 30.499],
    [-97.699, 30.499],
    [-97.699, 30.501],
    [-97.701, 30.501],
    [-97.701, 30.499],
  ]]);

  const estimate = estimateHouseFootprint(parcel);

  assert.ok(estimate);
  assert.ok(turf.area(estimate) > 0);
  assert.ok(turf.area(estimate) <= 190);
  assert.ok(turf.booleanWithin(estimate, parcel));
});

test("estimated house footprint returns null for a zero-area parcel", () => {
  const invalidParcel = {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [] },
  } as unknown as Parameters<typeof estimateHouseFootprint>[0];

  assert.equal(estimateHouseFootprint(invalidParcel), null);
});
