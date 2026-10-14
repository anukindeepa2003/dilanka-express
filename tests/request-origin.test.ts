import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedRequestOrigin as allowed } from "../src/lib/request-origin";

test("same-host writes work when Next uses its loopback bind address", () => {
  assert.equal(
    allowed(
      "http://localhost:3000",
      "http://127.0.0.1:3000/api/holds",
      "localhost:3000",
    ),
    true,
  );
  assert.equal(
    allowed(
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3000/api/holds",
      "127.0.0.1:3000",
    ),
    true,
  );
  assert.equal(
    allowed(
      "http://[::1]:3000",
      "http://127.0.0.1:3000/api/holds",
      "[::1]:3000",
    ),
    true,
  );
  assert.equal(
    allowed(
      "https://preview.example.com",
      "https://internal.example.com/api/holds",
      "preview.example.com",
    ),
    true,
  );
});
test("other sites, ports, protocols and loopback aliases stay blocked", () => {
  for (const origin of [
    "https://attacker.example",
    "http://localhost:4000",
    "https://localhost:3000",
    "http://127.0.0.1:3000",
    "null",
    "file://",
    "not a URL",
    "http://localhost:3000/path",
    "http://localhost:3000?x=1",
    "http://user@localhost:3000",
  ]) {
    assert.equal(
      allowed(origin, "http://127.0.0.1:3000/api/holds", "localhost:3000"),
      false,
      origin,
    );
  }
  for (const host of [
    "",
    "localhost:3000,attacker.example",
    "localhost:3000/evil",
    "attacker@localhost:3000",
    "localhost:3000\\evil",
    "localhost:3000?x",
    "localhost:3000#x",
  ]) {
    assert.equal(
      allowed("http://localhost:3000", "http://localhost:3000/api/holds", host),
      false,
      host,
    );
  }
});
test("missing Host falls back to the request URL; non-browser clients keep working", () => {
  assert.equal(
    allowed("http://localhost:3000", "http://localhost:3000/api/holds", null),
    true,
  );
  assert.equal(
    allowed("http://localhost:4000", "http://localhost:3000/api/holds", null),
    false,
  );
  assert.equal(
    allowed(null, "http://localhost:3000/api/holds", "localhost:3000"),
    true,
  );
});
