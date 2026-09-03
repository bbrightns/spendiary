# Project Rules & Guidelines for AI Agents

## Git Workflow Rules
1. **Commit after every file modification**: Every time you modify, add, or delete files in this project, you MUST perform a `git commit` with a clear commit message detailing the changes.
2. **NEVER PUSH WITHOUT EXPLICIT COMMAND**: Do **NOT** execute `git push` under any circumstances unless the user explicitly requests/commands it.
3. **Auto-Bump Version on User Push Command**: When the user explicitly requests to push (e.g., "push", "git push", "ช่วย push ให้หน่อย"):
   - Inspect all unpushed commits (`git log origin/main..HEAD --oneline`).
   - Determine the next Semantic Version based on Conventional Commits in the unpushed batch:
     - Contains breaking changes (`feat!:`, `fix!:`, or `BREAKING CHANGE`) ➜ Bump **MAJOR** (e.g., `1.5.0` ➜ `2.0.0`)
     - Contains any `feat(...)` ➜ Bump **MINOR** (e.g., `1.5.0` ➜ `1.6.0`)
     - Contains only `fix(...)`, `refactor(...)`, `style(...)`, `perf(...)`, `chore(...)` ➜ Bump **PATCH** (e.g., `1.5.0` ➜ `1.5.1`)
   - Update `version` in both `package.json` and `package-lock.json`.
   - Run verification (`npm run build`).
   - Commit the version bump: `git commit -am "chore(release): bump app version to X.Y.Z"`.
   - Only then execute `git push`.
4. **Report Commit Details in Responses**: Every time you perform a commit, you MUST explicitly report the commit hash (short SHA) and the exact commit message in your response to the user so the user is always informed of the changes (ต้องรายงาน commit hash และ commit message ทุกครั้งในคำตอบ).

## Quality & Pre-Commit Verification Rules
1. **Strict TypeScript & Unused Import Checking**:
   - Whenever code is replaced, refactored, or deleted, immediately inspect all imports and declared variables in the file.
   - Any unused import or variable (`TS6133`) MUST be removed before committing.
2. **Mandatory `git diff` Review**:
   - Review `git diff` before every commit to ensure no orphaned variables, unused imports, or broken contracts exist.
3. **Verify Type Consistency**:
   - Ensure all type definitions, props, and function signatures across caller/callee components are 100% matched.

## File Deletion & Safety Rules
1. **Never delete files without explicit permission**: Strictly prohibited from deleting any files or directories without asking for and receiving explicit confirmation from the user (ห้ามลบไฟล์โดยไม่ถามเด็ดขาด).

## General Project Overview
- **App Name**: Spendiary
- **Stack**: React 18 + TypeScript + Vite + Tailwind CSS v4
- **Storage**: `localStorage` (single-user dashboard)


