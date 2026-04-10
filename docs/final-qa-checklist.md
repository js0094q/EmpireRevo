# Final QA Checklist

- [x] Public nav is limited to `Board` and `Games`
- [x] Board is table-first and compact
- [x] Games is distinct from Board
- [x] Game detail is read-only and does not persist snapshots during render
- [x] Internal surface remains protected
- [x] Public UI uses shared formatters and view models
- [x] Browser-local preferences exist for league, model, min books, compact mode, and pinned books
- [x] Core fair-line math path remains unchanged
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`
- [x] `npm run test:visual`
