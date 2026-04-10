import { redirect } from "next/navigation";

export default async function GamesDetailAlias({
  params,
  searchParams
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { eventId } = await params;
  const query = new URLSearchParams();
  const current = (await searchParams) || {};
  for (const [key, value] of Object.entries(current)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => query.append(key, entry));
      continue;
    }
    if (typeof value === "string") query.set(key, value);
  }
  redirect(`/game/${encodeURIComponent(eventId)}${query.toString() ? `?${query.toString()}` : ""}`);
}
