import { ErrorState } from "@/components/primitives/ErrorState";
import Link from "next/link";

export default function NotFound() {
  return (
    <ErrorState
      title="Page not found"
      message="That path does not exist."
      detail={
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <span>The page may have moved or is not yet published.</span>
          <Link href="/">Return to home</Link>
        </div>
      }
    />
  );
}
