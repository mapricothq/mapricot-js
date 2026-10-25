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

const { results } = await client.search("128 SW 3rd Ave, Portland", { limit: 1 });
console.log(results[0].label, results[0].lat, results[0].lon);
```

In a web page, use a browser key, which works only from the origins you allow, and keep server keys on your server.

## Methods

Each method returns the API's JSON, typed, with the same field names as the [API reference](https://mapricot.com/api-reference/).

| Method | Endpoint |
| --- | --- |
| `client.search(q, { focus, country, limit, lang })` | [`GET /v1/search`](https://mapricot.com/docs/geocoding/#find-an-address) |
| `client.autocomplete(q, { focus, country, limit, lang })` | [`GET /v1/autocomplete`](https://mapricot.com/docs/places/#suggest-as-people-type) |
| `client.reverse(lat, lon, { limit, lang })` | [`GET /v1/reverse`](https://mapricot.com/docs/geocoding/#find-the-address-at-a-point) |
| `client.nearby(lat, lon, { category, radius, limit, lang })` | [`GET /v1/nearby`](https://mapricot.com/docs/places/#list-places-around-a-point) |
| `client.place(id, { lang })` | [`GET /v1/places/{id}`](https://mapricot.com/docs/places/#look-up-a-saved-place) |
| `client.route(waypoints, { mode })` | [`POST /v1/route`](https://mapricot.com/docs/routing/#get-a-route) |
| `client.ip(address)` | [`GET /v1/ip/{ip}`](https://mapricot.com/docs/ip-geolocation/#look-up-an-address) |
| `client.account()` | `GET /v1/account`, which checks a key and is never billed |

`focus` and each waypoint are `{ lat, lon }`. `country` and `category` take an array or a comma-separated string.

```js
const nearby = await client.nearby(45.52, -122.68, { category: ["food:coffee_shop"], radius: 1000 });
const { routes } = await client.route([{ lat: 45.5189, lon: -122.6793 }, { lat: 45.5214, lon: -122.6828 }], { mode: "walk" });
console.log(routes[0].durationSeconds);
```

To cancel a request, such as an autocomplete request for text that has since changed, pass an `AbortSignal` as `signal` to any method. The request then rejects with an `AbortError`:

```js
const controller = new AbortController();
const request = client.autocomplete("1005 W Burn", { signal: controller.signal });
controller.abort();
```

A route's `polyline` is encoded with six decimal places. Decode it with precision 6, as [decoding a route polyline](https://mapricot.com/guides/polyline-decoder/) shows.

If your app shows results, show the credits in each response's `attribution`.

## Errors and retries

An error response throws `MapricotError`, with the HTTP `status`, the API's error `code`, a `message`, and the `requestId`:

```js
import { MapricotError } from "mapricot";

try {
  await client.search("");
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
