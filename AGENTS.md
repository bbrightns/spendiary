# Project Rules & Guidelines for AI Agents

## Git Workflow Rules
1. **Commit after every file modification**: Every time you modify, add, or delete files in this project, you MUST perform a `git commit` with a clear commit message detailing the changes.
2. **NEVER PUSH**: Do **NOT** execute `git push` under any circumstances unless the user explicitly requests/commands it.

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


