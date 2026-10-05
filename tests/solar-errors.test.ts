import test from 'node:test';
import assert from 'node:assert/strict';
import * as turf from '@turf/turf';
import { solarMaskFootprint, SolarFootprintError } from '../src/lib/solar-footprint';

const parcel = turf.polygon([[[-97.0001,30],[-97,30],[-97,30.0001],[-97.0001,30.0001],[-97.0001,30]]]);
test('Solar distinguishes denied access and quotas from missing building data', async () => {
  const original = globalThis.fetch;
  try {
    for (const [status,code] of [[403,'solar_access_denied'],[429,'solar_quota_exceeded'],[503,'solar_temporarily_unavailable']] as const) {
      globalThis.fetch = async () => new Response('{}', {status});
      await assert.rejects(solarMaskFootprint(30.00005,-97.00005,'test',parcel), error => error instanceof SolarFootprintError && error.code === code);
    }
    globalThis.fetch = async () => new Response('{}', {status:404});
    assert.equal(await solarMaskFootprint(30.00005,-97.00005,'test',parcel),null);
  } finally { globalThis.fetch = original; }
});

test('Solar includes medium coverage without rejecting higher quality imagery', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.get('requiredQuality'), 'MEDIUM');
      assert.equal(url.searchParams.get('exactQualityRequired'), 'false');
      return new Response('{}', { status: 404 });
    };
    assert.equal(await solarMaskFootprint(30.00005,-97.00005,'test',parcel), null);
  } finally { globalThis.fetch = original; }
});
