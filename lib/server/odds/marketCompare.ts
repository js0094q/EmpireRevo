import type { MarketKey } from "@/lib/odds/schemas";

type Offer = {
  point?: number;
  priceAmerican: number;
};

function safePoint(point?: number): number {
  return Number.isFinite(point) ? Number(point) : Number.NEGATIVE_INFINITY;
}

function normalizedOutcomeName(value: string): string {
  return value.trim().toLowerCase();
}

function isOverOutcome(name: string): boolean {
  return normalizedOutcomeName(name).startsWith("over");
}

function isUnderOutcome(name: string): boolean {
  return normalizedOutcomeName(name).startsWith("under");
}

export function compareOffersByMarket(
  market: MarketKey,
  outcomeName: string,
  a: Offer,
  b: Offer
): number {
  if (market === "h2h") {
    return b.priceAmerican - a.priceAmerican;
  }

  if (market === "spreads") {
    const pointDelta = safePoint(b.point) - safePoint(a.point);
    if (pointDelta !== 0) return pointDelta;
    return b.priceAmerican - a.priceAmerican;
  }

  const over = isOverOutcome(outcomeName);
  const under = isUnderOutcome(outcomeName);
  const aPoint = safePoint(a.point);
  const bPoint = safePoint(b.point);
  if (over || under) {
    const directional = over ? aPoint - bPoint : bPoint - aPoint;
    if (directional !== 0) return directional;
  } else {
    const pointDelta = bPoint - aPoint;
    if (pointDelta !== 0) return pointDelta;
  }

  return b.priceAmerican - a.priceAmerican;
}
