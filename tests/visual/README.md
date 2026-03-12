# Visual Regression

This suite captures desktop and mobile snapshots for:

- Homepage (`/`)
- Game detail page (`/game/[eventId]`)

The runner starts a local mock odds API, boots the Next.js app against that API, and compares screenshots against committed baselines.

## Commands

```bash
npm run test:visual
```

Update or create baselines:

```bash
npm run test:visual -- --update
```

## Output folders

- `tests/visual/baseline/` committed baseline snapshots
- `tests/visual/current/` latest run snapshots (gitignored)
- `tests/visual/diff/` diff images for failing comparisons (gitignored)
