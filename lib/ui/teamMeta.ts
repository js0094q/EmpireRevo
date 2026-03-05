import { TEAM_LOGO_MAP } from "@/lib/server/odds/logos";

export function teamLogoFor(teamName: string): string | undefined {
  return TEAM_LOGO_MAP[teamName];
}

export function teamAbbrev(teamName: string): string {
  const compact = teamName
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((chunk) => chunk[0]?.toUpperCase() || "")
    .join("");
  return compact || teamName.slice(0, 3).toUpperCase();
}
