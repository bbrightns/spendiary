## What

<!-- One or two lines: what changes for the user, and why. -->

## Type

- [ ] Feature
- [ ] Fix
- [ ] UI / design
- [ ] Refactor
- [ ] Docs / chore

## Checks

- [ ] `npm run build` passes
- [ ] `npm run lint` has 0 errors
- [ ] `npm run lint:design` passes
- [ ] `npm test` passes
- [ ] Touched features tried in the dev server, no console errors

### UI (skip if no UI change)

- [ ] Read `DESIGN.md` and reused its components
- [ ] Light theme
- [ ] Dark theme
- [ ] Desktop (≥ 1280px)
- [ ] Mobile (375–430px), no horizontal scroll

<!-- Screenshots: before / after, light / dark if it helps. -->

## Data

- [ ] No change to the saved data shape
- [ ] Data shape changed, and `src/store/migrate.ts` upgrades old payloads
- [ ] Needs SQL run by hand in Supabase (paste it below, and run it before merging)

## Version

- [ ] Bumped once for this PR (patch / minor / major per `AGENTS.md`)
