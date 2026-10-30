import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { Mapricot } from "../dist/index.js";

async function serve(statuses) {
  const seen = [];
  const server = createServer((request, response) => {
    seen.push(request.url);
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      if (body) seen.push(JSON.parse(body));
      const [status, code] = statuses.shift() ?? [200];
      response.writeHead(status, { "Content-Type": "application/json", "X-Request-Id": "r1" });
      response.end(JSON.stringify(status === 200 ? { ok: true } : { error: { code, message: code }, requestId: "r1" }));
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  return { seen, server, baseUrl: `http://localhost:${server.address().port}` };
}

test("retries 503 and concurrency_exceeded, then succeeds", async (t) => {
  const { seen, server, baseUrl } = await serve([[503, "origin_overloaded"], [429, "concurrency_exceeded"]]);
  t.after(() => server.close());
  const client = new Mapricot({ apiKey: "k", baseUrl });
  assert.deepEqual(await client.geocoding.search("x", { focus: { lat: 1, lon: 2 }, country: ["US", "CA"] }), { ok: true });
  assert.equal(seen.length, 3);
  assert.equal(seen[0], "/geocoding/v1/search?q=x&focus=1%2C2&country=US%2CCA");
});

test("doesn't retry credit_exhausted", async (t) => {
  const { seen, server, baseUrl } = await serve([[429, "credit_exhausted"]]);
  t.after(() => server.close());
  const client = new Mapricot({ apiKey: "k", baseUrl });
  await assert.rejects(client.account(), { status: 429, code: "credit_exhausted", requestId: "r1" });
  assert.equal(seen.length, 1);
});

test("searchBatch sends queries as search parameters", async (t) => {
  const { seen, server, baseUrl } = await serve([]);
  t.after(() => server.close());
  await new Mapricot({ apiKey: "k", baseUrl }).geocoding.searchBatch([{ q: "x", focus: { lat: 1, lon: 2 }, country: ["US", "CA"], limit: 1 }]);
  assert.deepEqual(seen, ["/geocoding/v1/search/batch", { queries: [{ q: "x", focus: "1,2", country: "US,CA", limit: "1" }] }]);
});
