export function impliedProbFromAmerican(a: number): number {
  if (!Number.isFinite(a) || a === 0) return 0;
  if (a < 0) return -a / (-a + 100);
  return 100 / (a + 100);
}

export function americanFromProb(p: number): number {
  const pc = Math.min(0.999, Math.max(0.001, p));
  if (pc >= 0.5) return Math.round(-(pc / (1 - pc)) * 100);
  return Math.round(((1 - pc) / pc) * 100);
}

export function devigTwoWay(p1: number, p2: number): { p1NoVig: number; p2NoVig: number } {
  const total = p1 + p2;
  if (!Number.isFinite(total) || total <= 0) {
    return { p1NoVig: 0.5, p2NoVig: 0.5 };
  }
  return {
    p1NoVig: p1 / total,
    p2NoVig: p2 / total
  };
}

export function edgePct(bookProbNoVig: number, fairProb: number): number {
  return (bookProbNoVig - fairProb) * 100;
}
