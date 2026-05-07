import styles from "./workstation.module.css";

export function EdgeCell({ value, tone }: { value: string; tone: "positive" | "warning" | "neutral" | "danger" }) {
  return (
    <span
      className={[
        styles.numeric,
        tone === "positive" ? styles.edgePositive : "",
        tone === "warning" ? styles.edgeWarning : "",
        tone === "danger" ? styles.edgeDanger : "",
        tone === "neutral" ? styles.edgeNeutral : ""
      ].join(" ")}
    >
      {value}
    </span>
  );
}
