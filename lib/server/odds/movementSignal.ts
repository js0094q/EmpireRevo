import type { FairOutcomeBook } from "@/lib/server/odds/types";

type MovementSignal = {
  summary: string;
  quality: "strong" | "moderate" | "weak";
  diagnostics: {
    sharpAverageMove: number;
    retailAverageMove: number;
    movedBooks: number;
    totalBooks: number;
  };
};

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function summarizeMovementSignal(books: FairOutcomeBook[]): MovementSignal {
  const historyCounts = books.map((book) => book.movement?.history?.length ?? 0);
  const avgHistory = average(historyCounts);
  const sparseHistory = avgHistory < 2;
  const sharpMoveRows = books.filter((book) => book.isSharpBook);
  const sharpMoves = sharpMoveRows.map((book) => book.movement?.move ?? 0);
  const retailMoves = books.filter((book) => !book.isSharpBook).map((book) => book.movement?.move ?? 0);
  const sharpAvg = average(sharpMoves);
  const retailAvg = average(retailMoves);
  const movedBooks = books.filter((book) => Math.abs(book.movement?.move ?? 0) >= 2).length;
  const movedSharpBooks = sharpMoveRows.filter((book) => Math.abs(book.movement?.move ?? 0) >= 2).length;
  const movedRatio = books.length > 0 ? movedBooks / books.length : 0;
  const diagnostics = {
    sharpAverageMove: sharpAvg,
    retailAverageMove: retailAvg,
    movedBooks,
    totalBooks: books.length
  };

  if (
    Math.abs(sharpAvg) >= 5 &&
    Math.abs(retailAvg) < 3 &&
    books.length >= 4 &&
    sharpMoveRows.length >= 2 &&
    movedSharpBooks >= 1 &&
    movedRatio >= 0.35
  ) {
    if (sparseHistory) {
      return {
        summary: "Sharp books are moving, but history is still forming",
        quality: "moderate",
        diagnostics
      };
    }

    return {
      summary: "Fair line moving with sharp books",
      quality: "strong",
      diagnostics
    };
  }

  if (Math.abs(retailAvg) >= 5 && Math.abs(sharpAvg) < 3) {
    return {
      summary: "Retail drift only",
      quality: "moderate",
      diagnostics
    };
  }

  if (Math.abs(sharpAvg - retailAvg) >= 4) {
    return {
      summary: "Books are moving out of sync",
      quality: "moderate",
      diagnostics
    };
  }

  if (sparseHistory) {
    return {
      summary: "History still forming",
      quality: "weak",
      diagnostics
    };
  }

  return {
    summary: "Movement mixed across books",
    quality: "weak",
    diagnostics
  };
}
