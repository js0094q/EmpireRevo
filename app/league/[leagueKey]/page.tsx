import { redirect } from "next/navigation";

export default async function LeaguePage({ params }: { params: Promise<{ leagueKey: string }> }) {
  const { leagueKey } = await params;
  redirect(`/?league=${leagueKey}`);
}
