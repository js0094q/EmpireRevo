import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function GamesPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  const nextParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const entry of value) nextParams.append(key, entry);
      continue;
    }
    if (value !== undefined) nextParams.set(key, value);
  }

  const query = nextParams.toString();
  redirect(query ? `/?${query}` : "/");
}
