import { AppContainer } from "@/components/layout/AppContainer";
import { AppHeader } from "@/components/layout/AppHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import styles from "./BoardShell.module.css";

export function LoadingState({ message = "Building the latest board..." }: { message?: string }) {
  return (
    <div className={styles.stateShell}>
      <AppContainer>
        <AppHeader eyebrow="EmpirePicks" title="Loading board" subtitle={message} />
        <section className={styles.stateCard}>
          <div className={styles.loadingGrid}>
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className={styles.loadingCard}>
                <Skeleton style={{ height: 18, width: "30%" }} />
                <Skeleton style={{ height: 24, width: "55%" }} />
                <Skeleton style={{ height: 14, width: "80%" }} />
              </div>
            ))}
          </div>
        </section>
      </AppContainer>
    </div>
  );
}
