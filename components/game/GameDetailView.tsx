import { Panel } from "@/components/primitives/Panel";
import type { GameDetailPageData } from "@/lib/server/odds/gameDetailPageData";
import type { GameDetailViewModel } from "@/lib/ui/view-models/gameDetailViewModel";
import { BookComparisonTable } from "@/components/game/BookComparisonTable";
import { ConsensusSummary } from "@/components/game/ConsensusSummary";
import { GameHeader } from "@/components/game/GameHeader";
import { MarketHistoryPanel } from "@/components/game/MarketHistoryPanel";
import { MarketTabs } from "@/components/game/MarketTabs";
import { QualityNotesPanel } from "@/components/game/QualityNotesPanel";
import styles from "./detail.module.css";

export function GameDetailView({ viewModel, data }: { viewModel: GameDetailViewModel; data: GameDetailPageData }) {
  return (
    <div className={styles.surface}>
      <GameHeader
        title={viewModel.title}
        subtitle={viewModel.subtitle}
        status={viewModel.status}
        marketHealth={viewModel.marketHealth}
        backHref={viewModel.backHref}
      />

      <ConsensusSummary summary={viewModel.summary} />

      {viewModel.tabs.length ? (
        <Panel>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Markets</h2>
            <MarketTabs tabs={viewModel.tabs} />
          </div>
        </Panel>
      ) : null}

      <BookComparisonTable rows={viewModel.comparisonRows} />
      <MarketHistoryPanel viewModel={viewModel.history} data={data} />
      <QualityNotesPanel title="Quality Notes" notes={viewModel.qualityNotes} />
      <QualityNotesPanel title="Model Notes" notes={viewModel.modelNotes} />
      {viewModel.internalNotes ? (
        <Panel>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Internal</h2>
            <ul className={styles.notesList}>
              {viewModel.internalNotes.map((note) => (
                <li key={note.label}>
                  <strong>{note.label}:</strong> {note.value}
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
