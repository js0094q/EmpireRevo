import type { ReactNode } from "react";
import { forbidden, unauthorized } from "next/navigation";
import { headers } from "next/headers";
import { authorizeInternalHeaders } from "@/lib/server/odds/internalAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function InternalLayout({ children }: { children: ReactNode }) {
  const headerStore = await headers();
  const auth = authorizeInternalHeaders(headerStore);

  if (!auth.ok) {
    if (auth.code === "INTERNAL_AUTH_UNAVAILABLE") {
      forbidden();
    }
    unauthorized();
  }

  return <>{children}</>;
}
