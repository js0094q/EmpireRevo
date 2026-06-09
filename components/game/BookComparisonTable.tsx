import { Panel } from "@/components/primitives/Panel";
import { Table } from "@/components/primitives/Table";
import type { GameDetailViewModel } from "@/lib/ui/view-models/gameDetailViewModel";
import styles from "./detail.module.css";

export function BookComparisonTable({ rows }: { rows: GameDetailViewModel["comparisonRows"] }) {
  return (
    <Panel>
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Books</h2>
        <Table
          rows={rows}
          rowKey={(row) => row.book}
          columns={[
            { key: "book", header: "Book", render: (row) => row.book },
            { key: "price", header: "Odds", render: (row) => row.price },
            { key: "impliedProbability", header: "Implied Probability", render: (row) => row.impliedProbability },
            { key: "noVigProbability", header: "No-Vig Probability", render: (row) => row.noVigProbability },
            { key: "weight", header: "Book Weight", render: (row) => row.weight },
            { key: "freshness", header: "Last Updated", render: (row) => row.freshness },
            { key: "line", header: "Line", render: (row) => row.line },
            { key: "fair", header: "Fair", render: (row) => row.fair },
            { key: "ev", header: "EV", render: (row) => row.ev },
            { key: "notes", header: "Notes", render: (row) => row.notes }
          ]}
        />
      </div>
    </Panel>
  );
}
