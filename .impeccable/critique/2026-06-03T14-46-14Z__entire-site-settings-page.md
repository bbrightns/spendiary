---
target: entire site + Settings page
total_score: 27
p0_count: 0
p1_count: 1
timestamp: 2026-06-03T14-46-14Z
slug: entire-site-settings-page
---
### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Export triggers silently; import success disappears after 3s with no aria-live |
| 2 | Match System / Real World | 3 | "Corpus needed" still on Retirement; "Auto Transfers" slightly jargony |
| 3 | User Control and Freedom | 3 | Import overwrites data immediately; no undo path if wrong file chosen |
| 4 | Consistency and Standards | 3 | Export/import buttons use muted-pill style, not the system primary; minor deviation |
| 5 | Error Prevention | 3 | No pre-import backup prompt when user already has data; no negative-price guard on forms |
| 6 | Recognition Rather Than Recall | 3 | All actions labeled and visible; no icon-only navigation |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts; no bulk actions; power users have one rigid path |
| 8 | Aesthetic and Minimalist Design | 3 | "What's stored" card on Settings adds weight without earning it |
| 9 | Error Recovery | 3 | Import error messages specific and plain; form errors clear |
| 10 | Help and Documentation | 1 | No tooltips, no contextual hints anywhere on the site |
| **Total** | | **27/40** | **Acceptable** |

### Anti-Patterns Verdict
Detector: 0 findings. LLM: No AI slop. Restrained palette, semantic-only color, no gradient text, no glassmorphism, no eyebrow spam. Clean.

### Priority Issues

**[P1] Settings import overwrites data with no safety net**
Before calling setData, check if user has existing content. Show confirmation with item counts and an "Export first" link.

**[P2] "What's stored" card is decorative weight**
Collapse counts to a single line in the Data & Backup card. Remove the separate card.

**[P2] Bottom nav: 6 tabs too wide for small phones**
Move Settings out of bottom nav main rail. Use gear icon in PageHeader on mobile or "more" overflow.

**[P2] Import success/error not announced to screen readers**
Add role="status" aria-live="polite" to the feedback paragraph.

**[P3] Export gives no visual confirmation**
Add exportSuccess state that shows "Backup saved" inline for 3 seconds, same as import pattern.

### Minor Observations
- isValidData only checks key presence, not that values are arrays — add Array.isArray checks
- border-loss/20 on Danger Zone card too subtle; bg-loss-soft background tint would be clearer
- Retirement stats panel wording still pending
- Sidebar "Data stays on this device" copy needs update once Cloudflare lands
