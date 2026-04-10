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
            { key: "role", header: "Role", render: (row) => row.role },
            { key: "price", header: "Price", render: (row) => row.price },
            { key: "line", header: "Line", render: (row) => row.line },
            { key: "freshness", header: "Freshness", render: (row) => row.freshness },
            { key: "notes", header: "Notes", render: (row) => row.notes }
          ]}
        />
      </div>
    </Panel>
  );
}
