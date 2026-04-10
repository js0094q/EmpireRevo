import { Panel } from "@/components/primitives/Panel";
import { Table } from "@/components/primitives/Table";
import type { InternalDiagnosticsViewModel as InternalViewModel } from "@/lib/ui/view-models/internalDiagnosticsViewModel";
import styles from "./internal.module.css";

export function InternalEngineView({ viewModel }: { viewModel: InternalViewModel }) {
  return (
    <div className={styles.surface}>
      <div className={styles.header}>
        <h1 className={styles.title}>{viewModel.title}</h1>
        <p className={styles.subtitle}>{viewModel.subtitle}</p>
      </div>

      <Panel>
        <div className={styles.summaryGrid}>
          {viewModel.summary.map((item) => (
            <div key={item.label} className={styles.summaryItem}>
              <span className={styles.summaryLabel}>{item.label}</span>
              <strong>{item.value}</strong>
              {item.hint ? <span className={styles.summaryHint}>{item.hint}</span> : null}
            </div>
          ))}
        </div>
      </Panel>

      {viewModel.sections.map((section) => (
        <Panel key={section.title}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>{section.title}</h2>
            <Table
              rows={section.rows as Record<string, string>[]}
              rowKey={(row: Record<string, string>) => Object.values(row).join(":")}
              columns={section.columns.map((column) => ({
                key: column.key,
                header: column.header,
                render: (row: Record<string, string>) => row[column.key] || "—"
              }))}
            />
          </div>
        </Panel>
      ))}
    </div>
  );
}
