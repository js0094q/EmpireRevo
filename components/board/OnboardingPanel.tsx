"use client";

import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/primitives/Button";
import styles from "./OnboardingPanel.module.css";

type ExperienceMode = "beginner" | "advanced";

type OnboardingPanelProps = {
  open: boolean;
  mode: ExperienceMode;
  onClose: () => void;
  onModeChange: (mode: ExperienceMode) => void;
};

export function OnboardingPanel({ open, mode, onClose, onModeChange }: OnboardingPanelProps) {
  return (
    <Drawer open={open} onClose={onClose} className={styles.drawer}>
      <div className={styles.panelHeader}>
        <h2>How EmpirePicks works</h2>
        <p>Read this once, then use the board with confidence.</p>
      </div>

      <section className={styles.panelSection}>
        <h3>What is a fair line?</h3>
        <p>
          A fair line is the market-implied price after removing sportsbook margin and averaging multiple books.
          If a book is better than fair, that line may be a value opportunity.
        </p>
      </section>

      <section className={styles.panelSection}>
        <h3>What is EV?</h3>
        <p>
          EV is a directional signal showing expected value versus fair. Positive means a potential edge,
          neutral means close to fair value, and low/negative means less actionable right now.
        </p>
      </section>

      <section className={styles.panelSection}>
        <h3>Board glossary</h3>
        <ul className={styles.glossaryList}>
          <li>
            <strong>Best line:</strong> The strongest currently posted price across supported books.
          </li>
          <li>
            <strong>Gap:</strong> How far the best posted line is from fair.
          </li>
          <li>
            <strong>Confidence:</strong> How reliable the market consensus is in this moment.
          </li>
          <li>
            <strong>Movement:</strong> Recent price behavior and market pressure signals.
          </li>
        </ul>
      </section>

      <section className={styles.panelSection}>
        <h3>Interface mode</h3>
        <p className={styles.helpLine}>Use <em>Beginner</em> for faster decisions or <em>Advanced</em> for deep control.</p>
        <div className={styles.modeActions}>
          <Button type="button" onClick={() => onModeChange("beginner")} variant={mode === "beginner" ? "primary" : "default"}>
            Beginner
          </Button>
          <Button type="button" onClick={() => onModeChange("advanced")} variant={mode === "advanced" ? "primary" : "default"}>
            Advanced
          </Button>
        </div>
      </section>

      <div className={styles.actions}>
        <Button type="button" onClick={onClose} variant="primary">
          Got it
        </Button>
      </div>
    </Drawer>
  );
}
