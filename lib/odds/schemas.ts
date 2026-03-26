export type LeagueKey = "nfl" | "nba" | "nhl" | "ncaab" | "mlb";

export type MarketKey = "h2h" | "spreads" | "totals";

export type BookTier = "sharp" | "signal" | "exchange" | "mainstream" | "promo" | "unknown";

export type TeamRef = {
  id: string;
  name: string;
  abbrev?: string;
  logoUrl?: string;
};

export type EventRef = {
  id: string;
  league: LeagueKey;
  commenceTime: string;
  home: TeamRef;
  away: TeamRef;
  status: "upcoming" | "live" | "final";
};

export type BookRef = {
  key: string;
  title: string;
  tier: BookTier;
  weight: number;
  isSharpWeighted: boolean;
};

export type Outcome = {
  name: string;
  price: number;
  point?: number;
};

export type MarketSnapshot = {
  market: MarketKey;
  lastUpdate: string;
  outcomes: Outcome[];
};

export type BookSnapshot = {
  book: BookRef;
  markets: MarketSnapshot[];
};

export type NormalizedEventOdds = {
  event: EventRef;
  books: BookSnapshot[];
  fetchedAt: string;
};

export type DriverRef = {
  bookKey: string;
  bookTitle: string;
  weight: number;
};

export type DerivedSide = {
  label: string;
  bestPrice: { bookKey: string; bookTitle: string; price: number };
  consensusProb: number;
  fairProb: number;
  evPct: number;
  confidence: "High" | "Medium" | "Low";
  confidenceWhy: { books: number; variance: number; recencySec: number };
  leanPct: number;
  sharpDrivers: DriverRef[];
  explain: {
    equalWeightedProb: number;
    sharpWeightedProb: number;
    leanPct: number;
    bookCount: number;
    variance: number;
    recencySec: number;
    topDrivers: DriverRef[];
  };
  movement: {
    openPrice?: number;
    currentPrice?: number;
    prevPrice?: number;
    deltaCents?: number;
    moveCents?: number;
    icon?: "up" | "down" | "bolt" | "flat";
  };
};

export type DerivedMarket = {
  market: MarketKey;
  linePoint?: number;
  sides: DerivedSide[];
};

export type DerivedGame = {
  event: EventRef;
  markets: DerivedMarket[];
  updatedAt: string;
};

export type BoardFeedItem = {
  id: string;
  ts: string;
  type: "rapid_move" | "best_price_improved" | "ev_edge" | "pressure_spike";
  title: string;
  subtitle: string;
  gameId: string;
  market: MarketKey;
  confidence?: "High" | "Medium" | "Low";
};

export type BoardResponse = {
  league: LeagueKey;
  updatedAt: string;
  meta: {
    generatedAt: string;
    windowHours: number;
    disclaimer: string;
  };
  editorNote: {
    headline: string;
    body: string;
    watchlist: string[];
    lockLike: string[];
  };
  comingUp: DerivedGame[];
  bestValueNow: DerivedGame[];
  games: DerivedGame[];
  feed: BoardFeedItem[];
};
