import { test } from "node:test";
import assert from "node:assert/strict";
import { readCommandBody, RequestTooLarge } from "../src/lib/request-body";

test("request size limits count bytes and stop oversized chunked uploads", async () => {
  const ordinary = new Request("http://localhost/api/crm", {
    method: "POST",
    body: JSON.stringify({ action: "rename", name: "My workspace" }),
  });
  assert.equal((await readCommandBody(ordinary)).name, "My workspace");
  const unicode = new Request("http://localhost/api/crm", {
    method: "POST",
    body: JSON.stringify({ action: "import", text: "💬".repeat(260_000) }),
  });
  await assert.rejects(readCommandBody(unicode), RequestTooLarge);
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array(1_000_000));
    },
    cancel() {
      cancelled = true;
    },
  });
  const chunked = new Request("http://localhost/api/crm", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit);
  await assert.rejects(readCommandBody(chunked), RequestTooLarge);
  assert.equal(cancelled, true);
  const invalid = new Request("http://localhost/api/crm", {
    method: "POST",
    body: "not-json",
  });
  await assert.rejects(readCommandBody(invalid), SyntaxError);
});
