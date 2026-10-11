# Project Rules & Guidelines for AI Agents

## Git Workflow Rules
1. **Commit after every file modification**: Every time you modify, add, or delete files in this project, you MUST perform a `git commit` with a clear commit message detailing the changes.
2. **NEVER PUSH WITHOUT EXPLICIT COMMAND**: Do **NOT** execute `git push` under any circumstances unless the user explicitly requests/commands it.
3. **Auto-Bump Version on User Push Command**: When the user explicitly requests to push (e.g., "push", "git push", "help me push"):
   - Inspect all unpushed commits (`git log origin/main..HEAD --oneline`).
   - Determine the next Semantic Version based on the scope and significance of changes in the unpushed batch:
     - **MAJOR** (`X.0.0`): Breaking changes or foundational architecture rewrites (`feat!:`, `fix!:`, or `BREAKING CHANGE`) ➜ Bump **MAJOR** (e.g., `1.10.0` ➜ `2.0.0`)
     - **MINOR** (`1.X.0`):
       - Big Feature Milestone / New core module / New page system (e.g., Dividends Hub, AI Import, Retirement Engine)
       - **Comprehensive UI/UX Refactor / Multi-component overhaul**: System-wide redesign or UX changes (e.g., overhauling buttons and Design Tokens across pages, major Navigation/Layout changes)
       - **High Commit Accumulation**: A large batch of unpushed commits (≥ 10 commits) affecting multiple areas of functionality
       - When the user asks for a minor bump (e.g., "push minor", "bump the version") ➜ Bump **MINOR** (e.g., `1.10.14` ➜ `1.11.0`)
     - **PATCH** (`1.10.X`): Routine push within a development cycle, localized features, localized bug fixes, minor text/style tweaks, config, docs ➜ Bump **PATCH** (e.g., `1.11.0` ➜ `1.11.1`)
   - Update `version` in both `package.json` and `package-lock.json`.
   - Run verification (`npm run build`).
   - Commit the version bump: `git commit -am "chore(release): bump app version to X.Y.Z"`.
   - Complete the bug check (see "Bug Check Before Push") before bumping the version.
   - Only then execute `git push`.
4. **Report Commit Details in Responses**: Every time you perform a commit, you MUST explicitly report the commit hash (short SHA) and the exact commit message in your response to the user so the user is always informed of the changes.

## Quality & Pre-Commit Verification Rules
1. **Strict TypeScript & Unused Import Checking**:
   - Whenever code is replaced, refactored, or deleted, immediately inspect all imports and declared variables in the file.
   - Any unused import or variable (`TS6133`) MUST be removed before committing.
2. **Mandatory `git diff` Review**:
   - Review `git diff` before every commit to ensure no orphaned variables, unused imports, or broken contracts exist.
3. **Verify Type Consistency**:
   - Ensure all type definitions, props, and function signatures across caller/callee components are 100% matched.
4. **Visual Consistency Check (Before Every Commit That Touches UI)**:
   - If the change affects any UI (components, pages, styles, Tailwind classes, layout, or theme tokens), verify it before committing:
     - **Dark / Light theme**: Confirm the change renders correctly in both themes. No hardcoded colors that break in one theme, no unreadable text or low-contrast elements, and no missing `dark:` variants where needed.
     - **PC (wide screen)**: Confirm the layout works at desktop/wide widths (e.g., ≥ 1280px). No stretched, overflowing, or misaligned elements.
     - **Mobile**: Confirm the layout works at phone widths (e.g., 375px–430px). No horizontal scrolling, clipped content, or touch targets that are too small.
   - Check the result in the browser preview (or dev server) for all three cases. If a check cannot be performed, state that explicitly in the response instead of skipping it silently.
   - Fix any inconsistency found before committing.

## Bug Check Before Push
1. **Review all unpushed changes**: Inspect the full diff of every unpushed commit (`git diff origin/main..HEAD`) and look for logic errors, broken edge cases, missing null/undefined handling, and stale state or data-migration issues in `localStorage`.
2. **Run the checks**: Run `npm run build` and fix any TypeScript errors, `npm run lint` and fix every error (warnings are reported but don't block), and `npm test` (Vitest unit tests for pure logic such as `src/modules/spend/logic.ts`), which must pass.
3. **Verify affected features**: Exercise every feature touched by the unpushed commits in the dev server or browser preview, and check the browser console for runtime errors and warnings.
4. **Fix before pushing**: Any bug found MUST be fixed and committed before running `git push`. If a bug is out of scope, report it to the user and ask whether to fix it first.
5. **Report the result**: State in the response what was checked and the outcome. If a check could not be run, say so explicitly.

## File Deletion & Safety Rules
1. **Never delete files without explicit permission**: Strictly prohibited from deleting any files or directories without asking for and receiving explicit confirmation from the user.

## General Project Overview
- **App Name**: Spendiary
- **Stack**: React 18 + TypeScript + Vite + Tailwind CSS v4
- **Storage**: `localStorage` (single-user dashboard)
