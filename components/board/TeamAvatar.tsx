import Image from "next/image";
import styles from "./BoardShell.module.css";
import { cn } from "@/lib/ui/cn";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
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
          <span className={styles.teamAvatarFallback}>{initials(name)}</span>
        )}
      </span>
      {showName ? <span className={styles.teamAvatarName}>{name}</span> : null}
    </span>
  );
}
