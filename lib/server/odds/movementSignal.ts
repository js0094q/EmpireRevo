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
  const sharpMoves = books.filter((book) => book.isSharpBook).map((book) => book.movement?.move ?? 0);
  const retailMoves = books.filter((book) => !book.isSharpBook).map((book) => book.movement?.move ?? 0);
  const sharpAvg = average(sharpMoves);
  const retailAvg = average(retailMoves);
  const movedBooks = books.filter((book) => Math.abs(book.movement?.move ?? 0) >= 2).length;

  if (avgHistory < 2) {
    return {
      summary: "Movement signal weak due to sparse history",
      quality: "weak",
      diagnostics: {
        sharpAverageMove: sharpAvg,
        retailAverageMove: retailAvg,
        movedBooks,
        totalBooks: books.length
      }
    };
  }

  if (Math.abs(sharpAvg) >= 5 && Math.abs(retailAvg) < 3) {
    return {
      summary: "Fair line moving with sharp books",
      quality: "strong",
      diagnostics: {
        sharpAverageMove: sharpAvg,
        retailAverageMove: retailAvg,
        movedBooks,
        totalBooks: books.length
      }
    };
  }

  if (Math.abs(retailAvg) >= 5 && Math.abs(sharpAvg) < 3) {
    return {
      summary: "Retail drift only",
      quality: "moderate",
      diagnostics: {
        sharpAverageMove: sharpAvg,
        retailAverageMove: retailAvg,
        movedBooks,
        totalBooks: books.length
      }
    };
  }

  if (Math.abs(sharpAvg - retailAvg) >= 4) {
    return {
      summary: "Books are moving out of sync",
      quality: "moderate",
      diagnostics: {
        sharpAverageMove: sharpAvg,
        retailAverageMove: retailAvg,
        movedBooks,
        totalBooks: books.length
      }
    };
  }

  return {
    summary: "Movement mixed across books",
    quality: "weak",
    diagnostics: {
      sharpAverageMove: sharpAvg,
      retailAverageMove: retailAvg,
      movedBooks,
      totalBooks: books.length
    }
  };
}
