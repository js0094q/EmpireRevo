import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import { GET } from "../app/api/props/route";

test("GET /api/props short-circuits unsupported college baseball requests and returns an empty unsupported payload", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    throw new Error("Provider should not be called for unsupported college baseball props.");
  });

  try {
    const response = await GET(new Request("http://localhost/api/props?league=college_baseball&propType=main"));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.unsupported, true);
    assert.equal(payload.emptyReason, "PROPS_UNSUPPORTED_FOR_LEAGUE");
    assert.equal(payload.reason, "College Baseball props are not currently supported by the odds provider.");
    assert.equal(payload.rows.length, 0);
    assert.equal(payload.marketFamily, "unsupported");
    assert.equal(Array.isArray(payload.requestedMarkets), true);
    assert.equal(payload.requestedMarkets.length, 0);
    assert.equal(fetchMock.mock.calls.length, 0);
    assert.equal(payload.emptyState?.title, "College Baseball props are not currently supported by the odds provider.");
    assert.equal(
      payload.emptyState?.message,
      "Main markets are still available for College Baseball. Switch to Main Lines to continue browsing."
    );
  } finally {
    fetchMock.mock.restore();
  }
});
