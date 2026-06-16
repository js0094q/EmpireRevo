import { TrackOnMount } from "@/components/analytics/ProductAnalytics";
import { Panel } from "@/components/primitives/Panel";
import type { GameDetailPageData } from "@/lib/server/odds/gameDetailPageData";
import type { GameDetailViewModel } from "@/lib/ui/view-models/gameDetailViewModel";
import { BookComparisonTable } from "@/components/game/BookComparisonTable";
import { ConsensusSummary } from "@/components/game/ConsensusSummary";
import { GameHeader } from "@/components/game/GameHeader";
import { GamePropsSection } from "@/components/game/GamePropsSection";
import { MarketHistoryPanel } from "@/components/game/MarketHistoryPanel";
import { MarketTabs } from "@/components/game/MarketTabs";
import { OutcomeRecorder } from "@/components/game/OutcomeRecorder";
import { QualityNotesPanel } from "@/components/game/QualityNotesPanel";
import styles from "./detail.module.css";

export function GameDetailView({ viewModel, data }: { viewModel: GameDetailViewModel; data: GameDetailPageData }) {
  return (
    <div className={styles.surface}>
      <TrackOnMount
        eventName="game_open"
        properties={{
          sport: data.event.sportKey,
          market: data.event.market,
          outcome: data.featuredOutcome.name
        }}
      />
      <GameHeader
        title={viewModel.title}
        subtitle={viewModel.subtitle}
        status={viewModel.status}
        marketHealth={viewModel.marketHealth}
        backHref={viewModel.backHref}
      />

      <ConsensusSummary title="Best Available Price" summary={viewModel.summary} />
      <ConsensusSummary title="Fair Line Summary" summary={viewModel.fairLine} />

      {viewModel.tabs.length ? (
        <Panel>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Markets</h2>
            <MarketTabs tabs={viewModel.tabs} />
          </div>
        </Panel>
      ) : null}

      <BookComparisonTable rows={viewModel.comparisonRows} />
      <Panel>
        <GamePropsSection
          league={data.league}
          eventId={data.event.providerEventId || data.event.baseEventId || data.event.id}
          fallback={viewModel.props}
        />
      </Panel>
      <QualityNotesPanel title="Signal Quality" notes={viewModel.qualityNotes} />
      <MarketHistoryPanel viewModel={viewModel.history} data={data} />
      <Panel>
        <OutcomeRecorder outcome={viewModel.outcome} />
      </Panel>
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
