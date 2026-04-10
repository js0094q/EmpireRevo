import { Panel } from "@/components/primitives/Panel";
import styles from "./detail.module.css";

export function QualityNotesPanel({ title, notes }: { title: string; notes: string[] }) {
  return (
    <Panel>
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {notes.length ? (
          <ul className={styles.notesList}>
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.note}>No additional notes.</p>
        )}
      </div>
    </Panel>
  );
}
