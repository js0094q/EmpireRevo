import type { GameListGroupViewModel } from "@/lib/ui/view-models/boardViewModel";
import { GameSummaryRow } from "@/components/games/GameSummaryRow";
import styles from "@/components/board/workstation.module.css";

export function GamesGroup({ group }: { group: GameListGroupViewModel }) {
  return (
    <section className={styles.gamesGroup}>
      <h2 className={styles.gamesGroupTitle}>{group.label}</h2>
      {group.rows.map((row) => (
        <GameSummaryRow key={row.id} row={row} />
      ))}
    </section>
  );
}
