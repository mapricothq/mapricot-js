import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { Mapricot } from "../dist/index.js";

async function serve(statuses) {
  const seen = [];
  const server = createServer((request, response) => {
    seen.push(request.url);
    const [status, code] = statuses.shift() ?? [200];
    response.writeHead(status, { "Content-Type": "application/json", "X-Request-Id": "r1" });
    response.end(JSON.stringify(status === 200 ? { ok: true } : { error: { code, message: code }, request_id: "r1" }));
  });
  await new Promise((resolve) => server.listen(0, resolve));
  return { seen, server, baseUrl: `http://localhost:${server.address().port}` };
}

test("retries 503 and concurrency_exceeded, then succeeds", async (t) => {
  const { seen, server, baseUrl } = await serve([[503, "origin_overloaded"], [429, "concurrency_exceeded"]]);
  t.after(() => server.close());
  const client = new Mapricot({ apiKey: "k", baseUrl });
  assert.deepEqual(await client.search("x", { focus: { lat: 1, lon: 2 }, country: ["US", "CA"] }), { ok: true });
  assert.equal(seen.length, 3);
  assert.equal(seen[0], "/v1/search?q=x&focus=1%2C2&country=US%2CCA");
});

test("doesn't retry credit_exhausted", async (t) => {
  const { seen, server, baseUrl } = await serve([[429, "credit_exhausted"]]);
  t.after(() => server.close());
  const client = new Mapricot({ apiKey: "k", baseUrl });
  await assert.rejects(client.account(), { status: 429, code: "credit_exhausted", requestId: "r1" });
  assert.equal(seen.length, 1);
});
