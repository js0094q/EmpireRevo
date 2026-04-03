export function cn(...values: Array<string | false | null | undefined>): string {
  let className = "";

  for (const value of values) {
    if (!value) continue;
    if (className) className += " ";
    className += value;
  }

  return className;
}
