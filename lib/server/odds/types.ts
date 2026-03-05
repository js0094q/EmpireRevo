export type BookKey = string;

export type Outcome = {
  name: string;
  priceAmerican: number;
  point?: number;
};

export type Market = {
  key: "h2h" | "spreads" | "totals";
  lastUpdate?: string;
  outcomes: Outcome[];
};

export type BookOdds = {
  bookKey: BookKey;
  title: string;
  lastUpdate?: string;
  markets: Market[];
};

export type EventOdds = {
  id: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  sportKey: string;
  books: BookOdds[];
};

export type FairOutcomeBook = {
  bookKey: string;
  title: string;
  priceAmerican: number;
  impliedProbNoVig: number;
  edgePct: number;
  isBestPrice: boolean;
  point?: number;
  lastUpdate?: string;
};

export type FairOutcome = {
  name: string;
  fairProb: number;
  fairAmerican: number;
  consensusDirection: "favored" | "underdog" | "neutral";
  bestPrice: number;
  bestBook: string;
  books: FairOutcomeBook[];
};

export type FairEvent = {
  id: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  sportKey: string;
  market: "h2h" | "spreads" | "totals";
  linePoint?: number;
  bookCount: number;
  maxAbsEdgePct: number;
  outcomes: FairOutcome[];
};

export type FairBoardResponse = {
  ok: boolean;
  league: string;
  sportKey: string;
  market: "h2h" | "spreads" | "totals";
  model: "sharp" | "equal";
  updatedAt: string;
  lastUpdatedLabel: string;
  books: { key: string; title: string }[];
  events: FairEvent[];
  disclaimer: string;
};
