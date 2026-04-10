import test from "node:test";
import assert from "node:assert/strict";
import { getOddsApiBaseUrl } from "../lib/server/odds/env";

const ORIGINAL_BASE = process.env.ODDS_API_BASE;
const ORIGINAL_ALLOWED = process.env.ODDS_API_ALLOWED_HOSTS;

test.afterEach(() => {
  if (ORIGINAL_BASE === undefined) {
    delete process.env.ODDS_API_BASE;
  } else {
    process.env.ODDS_API_BASE = ORIGINAL_BASE;
  }

  if (ORIGINAL_ALLOWED === undefined) {
    delete process.env.ODDS_API_ALLOWED_HOSTS;
  } else {
    process.env.ODDS_API_ALLOWED_HOSTS = ORIGINAL_ALLOWED;
  }
});

test("getOddsApiBaseUrl defaults to the trusted upstream when unset", () => {
  delete process.env.ODDS_API_BASE;
  delete process.env.ODDS_API_ALLOWED_HOSTS;

  const base = getOddsApiBaseUrl();
  assert.equal(base.toString(), "https://api.the-odds-api.com/");
});

test("getOddsApiBaseUrl rejects non-https or unknown hosts", () => {
  process.env.ODDS_API_BASE = "http://api.the-odds-api.com";
  let base = getOddsApiBaseUrl();
  assert.equal(base.toString(), "https://api.the-odds-api.com/");

  process.env.ODDS_API_BASE = "https://example.com";
  base = getOddsApiBaseUrl();
  assert.equal(base.toString(), "https://api.the-odds-api.com/");
});

test("getOddsApiBaseUrl rejects credentials and custom ports", () => {
  process.env.ODDS_API_BASE = "https://user:pass@api.the-odds-api.com";
  let base = getOddsApiBaseUrl();
  assert.equal(base.toString(), "https://api.the-odds-api.com/");

  process.env.ODDS_API_BASE = "https://api.the-odds-api.com:8443";
  base = getOddsApiBaseUrl();
  assert.equal(base.toString(), "https://api.the-odds-api.com/");
});

test("getOddsApiBaseUrl accepts configured allowlisted hosts", () => {
  process.env.ODDS_API_ALLOWED_HOSTS = "odds.internal.example.com";
  process.env.ODDS_API_BASE = "https://odds.internal.example.com/v4/sports";

  const base = getOddsApiBaseUrl();
  assert.equal(base.toString(), "https://odds.internal.example.com/");
});

test("getOddsApiBaseUrl accepts loopback http hosts for local development", () => {
  process.env.ODDS_API_BASE = "http://127.0.0.1:4010/v4/sports";
  delete process.env.ODDS_API_ALLOWED_HOSTS;

  const base = getOddsApiBaseUrl();
  assert.equal(base.toString(), "http://127.0.0.1:4010/");
});
