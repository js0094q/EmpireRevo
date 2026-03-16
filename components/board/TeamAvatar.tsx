import Image from "next/image";
import type { CSSProperties } from "react";
import styles from "./BoardShell.module.css";
import { cn } from "@/lib/ui/cn";

function initials(name: string): string {
  const parts = name
    .replace(/[^a-zA-Z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "");

  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0] ?? "?";
  if (parts.length === 2) return `${parts[0] ?? ""}${parts[1] ?? ""}`;
  return `${parts[0] ?? ""}${parts[parts.length - 1] ?? ""}`;
}

function fallbackStyle(name: string): CSSProperties {
  const normalized = name.trim().toLowerCase();
  let hash = 0;
  for (let idx = 0; idx < normalized.length; idx += 1) {
    hash = (hash * 31 + normalized.charCodeAt(idx)) % 360;
  }
  return {
    ["--team-avatar-fallback-hue" as string]: hash
  };
}

export function TeamAvatar({
  name,
  logoUrl,
  size = "sm",
  showName = true,
  className
}: {
  name: string;
  logoUrl?: string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}) {
  const pixelSize = size === "lg" ? 40 : size === "md" ? 28 : 20;

  return (
    <span
      className={cn(styles.teamAvatar, styles[`teamAvatar${size[0].toUpperCase()}${size.slice(1)}`], className)}
      aria-label={showName ? undefined : name}
    >
      <span className={styles.teamAvatarIcon} aria-hidden="true">
        {logoUrl ? (
          <Image src={logoUrl} alt="" width={pixelSize} height={pixelSize} className={styles.teamAvatarImage} />
        ) : (
          <span className={styles.teamAvatarFallback} style={fallbackStyle(name)}>
            <span className={styles.teamAvatarFallbackText}>{initials(name)}</span>
          </span>
        )}
      </span>
      {showName ? <span className={styles.teamAvatarName}>{name}</span> : null}
    </span>
  );
}
