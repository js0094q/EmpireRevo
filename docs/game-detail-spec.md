# Game Detail Spec

## Structure

1. Event header
2. Consensus summary
3. Market tabs
4. Book comparison table
5. History panel when persisted data exists
6. Quality notes
7. Model notes
8. Internal notes only when authorized

## Rules

- Do not write persistence data during page render.
- Do not fabricate history.
- Keep comparison table disciplined: `Book`, `Role`, `Price`, `Line`, `Freshness`, `Notes`.
