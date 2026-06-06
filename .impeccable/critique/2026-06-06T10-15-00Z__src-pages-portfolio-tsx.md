---
target: Portfolio page
total_score: 24
p0_count: 0
p1_count: 2
timestamp: 2026-06-06T10-15-00Z
slug: src-pages-portfolio-tsx
---
### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live price dot + stale warning dot are good; no loading skeleton for the list |
| 2 | Match System / Real World | 3 | "Cost Basis" is jargon; "sats" and "Buy more" are natural |
| 3 | User Control and Freedom | 2 | Remove holding/location fires instantly — no undo, no confirmation |
| 4 | Consistency and Standards | 3 | Rows look identical but expand vs. open modal; sort Type lacks direction arrow |
| 5 | Error Prevention | 2 | No guard on destructive removals |
| 6 | Recognition Rather Than Recall | 3 | Expand affordance relies entirely on chevron; non-expandable rows have no visual tell |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts; no bulk actions |
| 8 | Aesthetic and Minimalist Design | 3 | Two-line row is clean; Performance Summary card carries too much responsibility |
| 9 | Error Recovery | 2 | Price retry button exists; remove/storage failures silently swallow errors |
| 10 | Help and Documentation | 1 | No tooltips, no glossary, no hint that BTC/Gold rows expand |
| **Total** | | **24/40** | **Acceptable** |

### Anti-Patterns Verdict

No AI slop detected. Detector returned zero findings. Clean source.

### Priority Issues

**[P1] No confirmation before destructive removals** — Remove holding fires instantly. No modal, no undo, no toast. For a personal finance app this is the most trust-damaging pattern possible.

**[P1] Buy button fails 44px touch target** — h-7 w-7 (28px) in row line 2. Users miss it on mobile, accidentally triggering expand/edit instead.

**[P2] One card doing five jobs** — Performance Summary card holds 3 metrics + search + 5 filter pills + 3 sort buttons + full holdings list. No visual separation.

**[P2] Rows with different click behaviors look identical** — Crypto/Gold expand; Fund/Stock open edit modal. Only differentiator is a subtle chevron.

**[P3] "Cost Basis" jargon** — Thai retail users may not know this means "amount invested."

### Persona Red Flags

**Riley**: Accidental hold removal is unrecoverable — no confirm, no toast, no undo.

**Casey**: 28px buy button causes 3 misses before success on one-handed mobile use.

**Sam**: "Remove holding" button inside expansion panel lacks context in VoiceOver (no aria-label with holding name). Live price status has no aria-live.
