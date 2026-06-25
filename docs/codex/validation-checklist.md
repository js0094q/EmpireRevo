# Validation Checklist

Run before handing work back.

## Standard Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

## Optional Visual Validation

Run only when UI layout, visual baselines, or mock sports feed output changes:

```bash
npm run test:visual
```

If intended visual changes alter snapshots:

```bash
npm run test:visual -- --update
```

## Manual Smoke Checks

When relevant:

- homepage loads
- board renders
- selected league remains in URL
- `/games` redirect preserves query params
- `/api/health` returns success if present
- `/api/status` reports provider status
- empty odds response does not crash UI
- internal routes remain protected

## Handoff Format

Final Codex response should include:

- branch name
- changed files
- validation commands and results
- commands not run and why
- required deployment env changes
- whether commit/push/deploy was performed
