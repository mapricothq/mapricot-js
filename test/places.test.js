import assert from "node:assert/strict";
import { test } from "node:test";
import { Mapricot } from "../dist/index.js";

test("places.get refuses a missing id without a request", async () => {
  const client = new Mapricot({ apiKey: "k", baseUrl: "http://localhost:1" });
  await assert.rejects(client.places.get(undefined), TypeError);
  await assert.rejects(client.places.get(""), TypeError);
});
