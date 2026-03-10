export function PersistenceUnavailable({ reason }: { reason: string }) {
  return (
    <main className="grid-shell">
      <section className="config-card">
        <h1>Persistence unavailable</h1>
        <p>{reason}</p>
        <p className="muted">
          The fair engine and board continue to run, but longitudinal diagnostics and CLV evaluation require durable persistence.
        </p>
      </section>
    </main>
  );
}
