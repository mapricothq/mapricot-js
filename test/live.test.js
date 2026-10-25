import assert from "node:assert/strict";
import { test } from "node:test";
import { Mapricot, MapricotError } from "../dist/index.js";

const skip = !process.env.MAPRICOT_KEY && "set MAPRICOT_KEY to run tests against the live API";
const client = !skip && new Mapricot({ apiKey: process.env.MAPRICOT_KEY });

test("search", { skip }, async () => {
  const { results, attribution } = await client.geocoding.search("128 SW 3rd Ave, Portland", { country: ["US"], limit: 1 });
  assert.equal(results[0].address.locality, "Portland");
  assert.ok(attribution.length > 0);
});

test("autocomplete", { skip }, async () => {
  const { results } = await client.geocoding.autocomplete("stumptown", { focus: { lat: 45.52, lon: -122.68 }, limit: 1 });
  assert.match(results[0].name, /Stumptown/);
});

test("reverse", { skip }, async () => {
  const { results } = await client.geocoding.reverse(45.5217, -122.6733, { limit: 1 });
  assert.equal(typeof results[0].distanceMeters, "number");
});

test("nearby", { skip }, async () => {
  const { results } = await client.places.nearby(45.52, -122.68, { category: ["food:coffee_shop"], radius: 1000, limit: 1 });
  assert.ok(results[0].categories.includes("food:coffee_shop"));
});

test("places.get", { skip }, async () => {
  const { results } = await client.geocoding.search("Pioneer Courthouse Square, Portland", { limit: 1 });
  const { result } = await client.places.get(results[0].id);
  assert.equal(result.id, results[0].id);
});

test("route", { skip }, async () => {
  const { routes } = await client.routing.route([{ lat: 43.7396, lon: 7.4275 }, { lat: 43.734, lon: 7.4222 }], { mode: "walk" });
  assert.equal(routes[0].legs.length, 1);
  assert.ok(routes[0].polyline);
  assert.equal(routes[0].legs[0].steps, undefined);
});

test("route steps in French", { skip }, async () => {
  const { routes } = await client.routing.route([{ lat: 43.7396, lon: 7.4275 }, { lat: 43.734, lon: 7.4222 }], { steps: true, lang: "fr" });
  assert.match(routes[0].legs[0].steps.at(-1).instruction, /destination/);
});

test("route as GeoJSON", { skip }, async () => {
  const { routes } = await client.routing.route([{ lat: 43.7396, lon: 7.4275 }, { lat: 43.734, lon: 7.4222 }], { geometries: "geojson" });
  assert.equal(routes[0].geometry.type, "LineString");
  assert.ok(routes[0].geometry.coordinates.length > 1);
});

test("isochrone", { skip }, async () => {
  const { features, attribution } = await client.routing.isochrone({ lat: 43.7396, lon: 7.4275 }, [5, 10], { mode: "walk" });
  assert.deepEqual(features.map((f) => f.properties.minutes), [10, 5]);
  assert.equal(features[0].geometry.type, "Polygon");
  assert.ok(attribution.length > 0);
});

test("ipGeolocation.lookup", { skip }, async () => {
  const location = await client.ipGeolocation.lookup("8.8.8.8");
  assert.equal(location.found, true);
  assert.equal(location.countryCode, "US");
});

test("account", { skip }, async () => {
  const account = await client.account();
  assert.equal(account.status, "active");
});

test("an invalid request throws MapricotError", { skip }, async () => {
  await assert.rejects(client.geocoding.search(""), (error) => {
    assert.ok(error instanceof MapricotError);
    assert.equal(error.status, 400);
    assert.equal(error.code, "invalid_request");
    assert.ok(error.requestId);
    return true;
  });
});

test("a bad key throws unauthorized", async () => {
  const bad = new Mapricot({ apiKey: "mapricot_sk_bad" });
  await assert.rejects(bad.account(), { status: 401, code: "unauthorized" });
});
