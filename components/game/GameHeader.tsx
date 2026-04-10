import Link from "next/link";
import { Badge } from "@/components/primitives/Badge";
import styles from "./detail.module.css";

export function GameHeader({
  title,
  subtitle,
  status,
  marketHealth,
  backHref
}: {
  title: string;
  subtitle: string;
  status: string;
  marketHealth: string;
  backHref: string;
}) {
  return (
    <div className={styles.header}>
      <div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <Badge tone={status === "Live" ? "accent" : "neutral"}>{status}</Badge>
        <Badge tone={marketHealth === "Limited" ? "warning" : "positive"}>{marketHealth}</Badge>
        <Link href={backHref}>Back to board</Link>
      </div>
    </div>
  );
}
