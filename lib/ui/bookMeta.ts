export type BookMeta = {
  label: string;
  shortLabel: string;
  logoSrc?: string;
};

const BOOK_META: Record<string, BookMeta> = {
  draftkings: {
    label: "DraftKings",
    shortLabel: "DK",
    logoSrc: "https://cdn.simpleicons.org/draftkings/6db33f"
  },
  fanduel: {
    label: "FanDuel",
    shortLabel: "FD",
    logoSrc: "https://cdn.simpleicons.org/fanduel/1e4db7"
  },
  betmgm: {
    label: "BetMGM",
    shortLabel: "MGM",
    logoSrc: "https://cdn.simpleicons.org/mgmresorts/ccb27a"
  },
  caesars: {
    label: "Caesars",
    shortLabel: "CZR",
    logoSrc: "https://cdn.simpleicons.org/caesarsentertainment/8f7a4a"
  },
  betrivers: {
    label: "BetRivers",
    shortLabel: "RIV"
  },
  pinnacle: {
    label: "Pinnacle",
    shortLabel: "PIN"
  },
  bookmaker: {
    label: "Bookmaker",
    shortLabel: "BM"
  },
  circa: {
    label: "Circa",
    shortLabel: "CIR"
  },
  lowvig: {
    label: "LowVig",
    shortLabel: "LV"
  },
  bovada: {
    label: "Bovada",
    shortLabel: "BOV"
  },
  espnbet: {
    label: "ESPN BET",
    shortLabel: "ESPN",
    logoSrc: "https://cdn.simpleicons.org/espn/c60c30"
  },
  betcris: {
    label: "BetCRIS",
    shortLabel: "CRIS"
  }
};

function initialShortLabel(label: string): string {
  const letters = label
    .split(" ")
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() || "")
    .join("");
  return letters || label.slice(0, 3).toUpperCase();
}

export function bookMetaFor(bookKey: string, fallbackTitle: string): BookMeta {
  const mapped = BOOK_META[bookKey];
  if (mapped) return mapped;

  return {
    label: fallbackTitle,
    shortLabel: initialShortLabel(fallbackTitle)
  };
}
