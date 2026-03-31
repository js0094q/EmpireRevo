import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ODDS_CALIBRATION, getOddsCalibration, resetCalibrationCacheForTests, type OddsCalibration } from "../lib/server/odds/calibration";
import { assessConfidence } from "../lib/server/odds/confidence";
import { rankOpportunity } from "../lib/server/odds/ranking";
import { detectStaleForBook } from "../lib/server/odds/staleDetection";
import type { FairOutcomeBook } from "../lib/server/odds/types";

function cloneCalibration(): OddsCalibration {
  return JSON.parse(JSON.stringify(DEFAULT_ODDS_CALIBRATION)) as OddsCalibration;
}

function book(partial: Partial<FairOutcomeBook> = {}): FairOutcomeBook {
  return {
    bookKey: partial.bookKey || "book",
    title: partial.title || "Book",
    tier: partial.tier || "mainstream",
    isSharpBook: partial.isSharpBook ?? false,
    weight: partial.weight ?? 1,
    priceAmerican: partial.priceAmerican ?? -110,
    impliedProb: partial.impliedProb ?? 0.52,
    impliedProbNoVig: partial.impliedProbNoVig ?? 0.5,
    edgePct: partial.edgePct ?? 0.8,
    evPct: partial.evPct ?? 1.2,
    evQualified: partial.evQualified ?? true,
    evReliability: partial.evReliability ?? "full",
    isBestPrice: partial.isBestPrice ?? false,
    lastUpdate: partial.lastUpdate ?? new Date().toISOString(),
    movement: partial.movement
  };
}

test("confidence label boundaries respond to calibration thresholds", () => {
  const calibration = cloneCalibration();
  calibration.confidence.labelThresholds.highConfidence = 0.9;

  const sample = assessConfidence({
    books: [
      book({ bookKey: "pinnacle", isSharpBook: true, tier: "sharp", impliedProbNoVig: 0.51 }),
      book({ bookKey: "circa", isSharpBook: true, tier: "sharp", impliedProbNoVig: 0.509 }),
      book({ bookKey: "fanduel", impliedProbNoVig: 0.507 })
    ],
    contributingBooks: 3,
    totalBooks: 4,
    excludedBooks: [],
    calibration
  });

  assert.notEqual(sample.label, "High Confidence");
});

test("stale thresholds transition correctly with calibration override", () => {
  const calibration = cloneCalibration();
  calibration.stale.thresholds.stalePriceStrength = 0.45;

  const staleTs = new Date(Date.now() - 90 * 60 * 1000).toISOString();
  const rows = detectStaleForBook({
    market: "h2h",
    confidenceScore: 0.75,
    calibration,
    books: [
      book({ bookKey: "sharp", isSharpBook: true, tier: "sharp", priceAmerican: -120, edgePct: 0.15 }),
      book({ bookKey: "retail", priceAmerican: -121, edgePct: 0.12 }),
      book({ bookKey: "lag", title: "Lag", priceAmerican: -104, edgePct: 1.3, isBestPrice: true, lastUpdate: staleTs })
    ]
  });

  const lag = rows.find((entry) => entry.bookKey === "lag");
  assert.ok(lag);
  assert.notEqual(lag?.staleFlag, "none");
});

test("ranking weights and penalties can reorder opportunities", () => {
  const calibration = cloneCalibration();
  calibration.ranking.penalties.sparseCoveragePenalty = 25;

  const confidenceStrong = assessConfidence({
    books: [book({ isSharpBook: true, tier: "sharp" }), book({})],
    contributingBooks: 2,
    totalBooks: 3,
    excludedBooks: [],
    calibration
  });

  const confidenceThin = assessConfidence({
    books: [book({ bookKey: "thin" })],
    contributingBooks: 1,
    totalBooks: 8,
    excludedBooks: [],
    calibration
  });

  const broad = rankOpportunity({
    market: "h2h",
    confidence: confidenceStrong,
    books: [book({ edgePct: 1.2, evPct: 2.5, isBestPrice: true })],
    contributingBooks: 2,
    totalBooks: 3,
    calibration
  });

  const sparse = rankOpportunity({
    market: "h2h",
    confidence: confidenceThin,
    books: [book({ edgePct: 2.2, evPct: 4.5, isBestPrice: true })],
    contributingBooks: 1,
    totalBooks: 8,
    calibration
  });

  assert.ok(broad.score > sparse.score);
});

test("calibration sanitization normalizes invalid weight overrides", () => {
  process.env.ODDS_CALIBRATION_OVERRIDES_JSON = JSON.stringify({
    ranking: {
      componentWeights: {
        edge: -2,
        ev: 2,
        confidence: 2,
        coverage: 2,
        sharpParticipation: 2,
        freshness: 2,
        stale: 2,
        sharpDeviation: 2
      }
    }
  });
  resetCalibrationCacheForTests();
  const calibration = getOddsCalibration();
  const total = Object.values(calibration.ranking.componentWeights).reduce((sum, value) => sum + value, 0);

  assert.ok(Math.abs(total - 1) < 1e-9);
  assert.ok(calibration.ranking.componentWeights.edge >= 0);

  delete process.env.ODDS_CALIBRATION_OVERRIDES_JSON;
  resetCalibrationCacheForTests();
});
