import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTY_BY_CITY, COUNTY_BY_ZIP, SERVICE_CITIES, SERVICE_ZIP_CODES, ZIP_CITY_MAP } from '../src/lib/constants';
import { countyLookupOrder, extractLocality, normalizeCounty } from '../src/lib/county-parcels';

test('every service city and ZIP maps to a county and city', () => {
 for (const city of SERVICE_CITIES) assert.ok(COUNTY_BY_CITY[city], city);
 for (const zip of SERVICE_ZIP_CODES) {
  assert.ok(COUNTY_BY_ZIP[zip], zip);
  assert.ok(ZIP_CITY_MAP[zip], zip);
 }
 assert.equal(COUNTY_BY_ZIP['78660'], 'Travis');
 assert.equal(ZIP_CITY_MAP['78704'], 'Austin');
});

test('county names from Google are normalized', () => {
 assert.equal(normalizeCounty('Travis County'), 'Travis');
 assert.equal(normalizeCounty('williamson'), 'Williamson');
 assert.equal(normalizeCounty('Dallas County'), null);
});

test('lookup order prefers the Google county, then ZIP, and always keeps both cadastres', () => {
 assert.deepEqual(countyLookupOrder({ county: 'Travis County' }), ['Travis', 'Williamson']);
 assert.deepEqual(countyLookupOrder({ zip: '78634' }), ['Williamson', 'Travis']);
 assert.deepEqual(countyLookupOrder({ zip: '78660' }), ['Travis', 'Williamson']);
 assert.deepEqual(countyLookupOrder({ city: 'Austin' }), ['Travis', 'Williamson']);
 assert.deepEqual(countyLookupOrder({ county: 'Hays County' }), ['Williamson', 'Travis']);
});

test('geocode components expose county, ZIP and city', () => {
 const result = extractLocality([
  { long_name: 'Austin', types: ['locality'] },
  { long_name: 'Travis County', types: ['administrative_area_level_2'] },
  { long_name: '78704', types: ['postal_code'] },
 ]);
 assert.deepEqual(result, { county: 'Travis County', zip: '78704', city: 'Austin' });
});
