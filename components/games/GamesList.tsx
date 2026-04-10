import type { GameListGroupViewModel } from "@/lib/ui/view-models/boardViewModel";
import { GamesGroup } from "@/components/games/GamesGroup";
import styles from "@/components/board/workstation.module.css";

export function GamesList({ groups }: { groups: GameListGroupViewModel[] }) {
  return (
    <div className={styles.gamesList}>
      {groups.map((group) => (
        <GamesGroup key={group.label} group={group} />
      ))}
    </div>
  );
}
