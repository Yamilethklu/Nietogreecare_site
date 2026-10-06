import test from "node:test";
import assert from "node:assert/strict";
import * as turf from "@turf/turf";

import { getMicrosoftFootprint } from "../src/lib/microsoft-footprint.ts";

const parcel = turf.polygon([[
  [-97.7, 30.5],
  [-97.699, 30.5],
  [-97.699, 30.501],
  [-97.7, 30.501],
  [-97.7, 30.5],
]]);

test("Microsoft footprint lookup fails closed when its dataset index is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  globalThis.fetch = async () => new Response("", { status: 503 });
  console.warn = (...values: unknown[]) => warnings.push(values);

  try {
    assert.equal(await getMicrosoftFootprint(parcel), null);
    assert.deepEqual(warnings, [["microsoft_footprint_dataset_unavailable"]]);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});

test("Microsoft footprint lookup fetches only matching quadkey tiles and clips building features", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  const calls: string[] = [];
  const building = {
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
  };
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("dataset-links.csv")) {
      return new Response("Location,QuadKey,Url\nUnited States,0,https://bfppub.blob.core.windows.net/buildings/tile.jsonl\n");
    }
    return new Response(`${JSON.stringify(building)}\n`);
  };
  console.warn = (...values: unknown[]) => warnings.push(values);

  try {
    const footprint = await getMicrosoftFootprint(parcel);
    assert.ok(footprint);
    assert.equal(footprint.geometry.type, "Polygon");
    assert.equal(calls.length, 2);
    assert.equal(warnings.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});
