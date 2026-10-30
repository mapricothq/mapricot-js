# Mapricot for JavaScript and TypeScript

The official JavaScript client for the [Mapricot API](https://mapricot.com/): address and place search, reverse geocoding, nearby places, routing, and IP geolocation, with 250,000 free requests every 30 days.

```sh
npm install mapricot
```

It uses the built-in `fetch`, so it has no dependencies and runs in Node.js 20 and later, Deno (as `npm:mapricot`), Bun, Cloudflare Workers, and browsers as old as Chrome 66, Firefox 57, and Safari 12.1. Types are included.

## Quick start

Create a server key in the [dashboard](https://app.mapricot.com/) and pass it to the client. Keep it out of your source code, for example by reading it from an environment variable as here.

```js
import { Mapricot } from "mapricot";

const client = new Mapricot({ apiKey: process.env.MAPRICOT_KEY });

const { results } = await client.geocoding.search("128 SW 3rd Ave, Portland", { limit: 1 });
console.log(results[0].label, results[0].lat, results[0].lon);
```

In a web page, use a browser key, which works only from the origins you allow, and keep server keys on your server.

## Methods

Methods are grouped by product, the same way as the API's paths. Each returns the API's JSON, typed, with the same field names as the [API reference](https://mapricot.com/api-reference/).

| Method | Endpoint |
| --- | --- |
| `client.geocoding.search(q, { focus, country, limit, lang })` | [`GET /geocoding/v1/search`](https://mapricot.com/docs/geocoding/#find-an-address) |
| `client.geocoding.searchBatch(queries)` | [`POST /geocoding/v1/search/batch`](https://mapricot.com/docs/geocoding/#search-a-list-of-addresses) |
| `client.geocoding.autocomplete(q, { focus, country, limit, lang })` | [`GET /geocoding/v1/autocomplete`](https://mapricot.com/docs/geocoding/#suggest-as-people-type) |
| `client.geocoding.reverse(lat, lon, { limit, lang })` | [`GET /geocoding/v1/reverse`](https://mapricot.com/docs/geocoding/#find-the-address-at-a-point) |
| `client.places.nearby(lat, lon, { category, radius, limit, lang })` | [`GET /places/v1/nearby`](https://mapricot.com/docs/places/#list-places-around-a-point) |
| `client.places.get(id, { lang })` | [`GET /places/v1/{id}`](https://mapricot.com/docs/places/#look-up-a-saved-place) |
| `client.routing.route(waypoints, { mode, geometries, steps, lang })` | [`POST /routing/v1/route`](https://mapricot.com/docs/routing/#get-a-route) |
| `client.routing.optimize(waypoints, { mode, geometries, steps, lang })` | [`POST /routing/v1/optimize`](https://mapricot.com/docs/routing/#optimize-the-order-of-stops) |
| `client.routing.isochrone(location, minutes, { mode })` | [`POST /routing/v1/isochrone`](https://mapricot.com/docs/routing/#get-an-isochrone) |
| `client.ipGeolocation.lookup(ip)` | [`GET /ip-geolocation/v1/{ip}`](https://mapricot.com/docs/ip-geolocation/#look-up-an-address) |
| `client.account()` | `GET /account`, which checks a key and is never billed |

`focus` and each waypoint are `{ lat, lon }`. `country` and `category` take an array or a comma-separated string.

```js
const nearby = await client.places.nearby(45.52, -122.68, { category: ["food:coffee_shop"], radius: 1000 });
const { routes } = await client.routing.route([{ lat: 45.5189, lon: -122.6793 }, { lat: 45.5214, lon: -122.6828 }], { mode: "walk" });
console.log(routes[0].durationSeconds);
```

`searchBatch` runs up to 100 searches in one request. Each query is an object of `search`'s parameters, and `responses` answers them in the same order, each with `results` and `attribution`, or an `error` with the `code` and `message` that search would get, without rejecting. Each completed search is billed as one request; errors aren't.

```js
const { responses } = await client.geocoding.searchBatch([{ q: "128 SW 3rd Ave, Portland", limit: 1 }, { q: "10 Downing Street, London", limit: 1 }]);
for (const response of responses) console.log(response.error?.message ?? response.results[0].label);
```

To cancel a request, such as an autocomplete request for text that has since changed, pass an `AbortSignal` as `signal` to any method. The request then rejects with an `AbortError`:

```js
const controller = new AbortController();
const request = client.geocoding.autocomplete("1005 W Burn", { signal: controller.signal });
controller.abort();
```

A route's path comes as an encoded `polyline` with five decimal places, which polyline decoders assume. Pass `geometries: "geojson"` to get it as a GeoJSON `LineString` in `geometry` instead, which maps draw without decoding, or `geometries: "polyline6"` for six decimal places.

`routing.optimize` takes the same options as `routing.route` and returns the route that visits the waypoints in a fast order, keeping the first and last in place. It adds `waypointOrder`: the indexes of your waypoints in visiting order, which `legs` follow. Every pair of waypoints must be within 400 km of each other for `drive`, or 200 km for `walk` and `bicycle`.

An isochrone is a GeoJSON `FeatureCollection` with one polygon per time, largest first, so a map that draws them in order shows the smaller ones on top:

```js
const area = await client.routing.isochrone({ lat: 45.5189, lon: -122.6793 }, [5, 10], { mode: "walk" });
map.addSource("reach", { type: "geojson", data: area });
```

Pass `steps: true` and each leg's `steps` has its turn-by-turn directions: an `instruction`, its distance and time, and its `lat` and `lon`. They're in English unless you pass `lang`, such as `lang: "fr"`.

If your app shows results, show the credits in each response's `attribution`.

## Errors and retries

An error response throws `MapricotError`, with the HTTP `status`, the API's error `code`, a `message`, and the `requestId`:

```js
import { MapricotError } from "mapricot";

try {
  await client.geocoding.search("");
} catch (error) {
  if (!(error instanceof MapricotError)) throw error;
  console.log(error.status, error.code, error.message); // 400 invalid_request The service rejected the request.
}
```

The client retries `503` responses and `429 concurrency_exceeded`, up to twice, waiting longer each time. Errors aren't billed. Set `maxRetries` and `timeout` (milliseconds) in the constructor's options to change this. The [API reference](https://mapricot.com/api-reference/#errors) lists every status.

## Links

- [Mapricot](https://mapricot.com/)
- [Node.js docs](https://mapricot.com/docs/node/)
- [API reference](https://mapricot.com/api-reference/)
- [Pricing](https://mapricot.com/pricing/)
