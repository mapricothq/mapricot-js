import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { Mapricot } from "../dist/index.js";

async function serve(handler) {
  const seen = [];
  const server = createServer((request, response) => {
    seen.push(request.url);
    handler(response);
  });
  await new Promise((resolve) => server.listen(0, resolve));
  return { seen, server, baseUrl: `http://localhost:${server.address().port}` };
}

test("a signal cancels a request in progress", async (t) => {
  const controller = new AbortController();
  const { seen, server, baseUrl } = await serve(() => controller.abort());
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const client = new Mapricot({ apiKey: "k", baseUrl });
  const request = client.geocoding.autocomplete("stump", { limit: 5, signal: controller.signal });
  await assert.rejects(request, { name: "AbortError" });
  assert.deepEqual(seen, ["/geocoding/v1/autocomplete?q=stump&limit=5"]);
});

test("a signal stops the wait before a retry", async (t) => {
  const controller = new AbortController();
  const { seen, server, baseUrl } = await serve((response) => {
    response.writeHead(503, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: { code: "origin_overloaded", message: "busy" } }), () => controller.abort());
  });
  t.after(() => server.close());
  const client = new Mapricot({ apiKey: "k", baseUrl });
  const request = client.routing.route([{ lat: 1, lon: 2 }, { lat: 3, lon: 4 }], { signal: controller.signal });
  await assert.rejects(request, { name: "AbortError" });
  assert.equal(seen.length, 1);
});

test("an aborted signal sends nothing", async (t) => {
  const { seen, server, baseUrl } = await serve(() => {});
  t.after(() => server.close());
  const client = new Mapricot({ apiKey: "k", baseUrl });
  await assert.rejects(client.ipGeolocation.lookup("8.8.8.8", { signal: AbortSignal.abort() }), { name: "AbortError" });
  assert.equal(seen.length, 0);
});

test("timeout cancels a request that takes too long", async (t) => {
  const { server, baseUrl } = await serve(() => {});
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const client = new Mapricot({ apiKey: "k", baseUrl, timeout: 50 });
  await assert.rejects(client.account(), { name: "TimeoutError" });
});
