---
name: Spendiary
description: A private financial cockpit for tracking investments, DCA plans, and bank transfer schedules in Thai Baht.
colors:
  canvas: "#f6f7f9"
  surface: "#ffffff"
  surface-muted: "#f3f4f6"
  ink: "#0b0d12"
  ink-hover: "#1d2230"
  ink-soft: "#3d424d"
  ink-muted: "#555b6a"
  ink-faint: "#6b7280"
  ink-deep: "#23283a"
  line: "#ecedf1"
  line-strong: "#e2e4ea"
  brand: "#4f46e5"
  brand-soft: "#eef0ff"
  brand-ink: "#3730a3"
  gain: "#0a9d68"
  gain-soft: "#e4f7ef"
  loss: "#e0506a"
  loss-soft: "#fdebef"
  warn: "#c9821a"
  warn-soft: "#fdf3e2"
  funds: "#6366f1"
  stocks: "#0ea5e9"
  crypto: "#f59e0b"
  cash: "#10b981"
typography:
  display:
    fontFamily: "'Plus Jakarta Sans', Inter, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 800
    fontSize: "52px"
    lineHeight: 1
    letterSpacing: "-0.025em"
    fontFeature: "'cv11', 'ss01', 'tnum'"
  headline:
    fontFamily: "'Plus Jakarta Sans', Inter, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 800
    fontSize: "40px"
    lineHeight: 1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "'Plus Jakarta Sans', Inter, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 700
    fontSize: "17px"
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif"
    fontWeight: 400
    fontSize: "14px"
    lineHeight: 1.6
  label:
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif"
    fontWeight: 600
    fontSize: "12.5px"
    lineHeight: 1.4
rounded:
  xs: "8px"
  sm: "12px"
  md: "16px"
  card: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    darkBackgroundColor: "#4f46e5"
    darkTextColor: "#ffffff"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
    darkBackgroundColor: "#4338ca"
  button-brand-icon:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.brand}"
    rounded: "{rounded.full}"
    size: "36px"
  button-brand-icon-hover:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.surface}"
  chip-filter:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.full}"
    padding: "6px 14px"
  chip-filter-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    darkBackgroundColor: "#4f46e5"
    darkTextColor: "#ffffff"
    rounded: "{rounded.full}"
    padding: "6px 14px"
  chip-gain:
    backgroundColor: "{colors.gain-soft}"
    textColor: "{colors.gain}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  chip-loss:
    backgroundColor: "{colors.loss-soft}"
    textColor: "{colors.loss}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "44px"
  field-focus:
    textColor: "{colors.brand}"
---

# Design System: Spendiary

## 1. Overview

**Creative North Star: "The Control Room"**

Spendiary is a one-user, private financial cockpit. The interface speaks with quiet authority: every readout is calibrated, every element earns its presence. There is no decoration for its own sake. The design feels less like a consumer app and more like a well-engineered instrument — the kind that rewards repeated use and never demands attention it hasn't earned.

The density is deliberate but not punishing. The system surfaces real financial data — portfolio values, DCA progress, transfer schedules — on a calm, light-toned surface without the Bloomberg wall-of-numbers assault. Color is reserved exclusively for signal: emerald for gain, rose for loss, amber for expiring, indigo for "act here." When those colors appear they carry weight precisely because they're absent everywhere else.

This is not a social product and not a motivational tool. No sharing affordances, no streak counters, no animated celebrations. The emotional register is composed, not congratulatory. It exists for one person who already understands their finances — and does not need the interface to explain money to them.

**Key Characteristics:**
- Ink-on-white surfaces with a cool barely-tinted canvas; card-first page composition
- Plus Jakarta Sans extrabold for all financial figures and section titles; Inter for everything else
- Semantic-only color — the neutral ink family carries 90% of the text surface; accents appear only when they carry financial meaning
- Ambient two-layer shadow separates surfaces from canvas; cards combine a hairline border with a soft diffuse shadow as the base register
- Mobile-first: frosted-glass bottom nav; fixed sidebar on desktop (lg+); layout never changes in structure between modes, only in nav chrome

## 2. Colors: The Precision Palette

A restrained neutral base with a single indigo accent and a tight vocabulary of financial-semantic signals. The neutrals dominate; every non-neutral color is a datum, not decoration.

### Primary
- **Precision Indigo** (#4f46e5, `--color-brand`): The one active-state color. Active nav states, focus rings, brand CTAs, and data indicators for the brand. Appears when the interface is saying "act here." Reserved. Never floods a surface.
- **Brand Tint** (#eef0ff, `--color-brand-soft`): Soft indigo for icon container backgrounds and interactive element resting states. Used at ~11% opacity via `color-mix`.
- **Brand Dark** (#3730a3, `--color-brand-ink`): Hover and active text states for brand-colored elements. Active nav label color on mobile.

### Tertiary (financial semantics)
- **Gain Emerald** (#0a9d68, `--color-gain`) with Soft (#e4f7ef, `--color-gain-soft`): Positive returns, "Bought" status. Use soft as chip background, full color as text/icon.
- **Loss Rose** (#e0506a, `--color-loss`) with Soft (#fdebef, `--color-loss-soft`): Negative returns, overdue states.
- **Warn Amber** (#c9821a, `--color-warn`) with Soft (#fdf3e2, `--color-warn-soft`): Expiring transfers, caution states.

### Neutral
- **Deep Slate** (#0b0d12, `--color-ink`): Primary text. Near-black with a cool blue-grey undertone. Also the primary button background.
- **Ink Soft** (#3d424d, `--color-ink-soft`): Secondary text, row values, field labels.
- **Ink Muted** (#555b6a, `--color-ink-muted`): Labels, captions, metadata. The dominant label color across the interface. Darkened from #6b7280 to meet WCAG AA 4.5:1 on surface-muted.
- **Ink Faint** (#6b7280, `--color-ink-faint`): Placeholder text only. Darkened from #8e939e to meet WCAG AA 4.5:1 on white.
- **Ink Deep** (#23283a, `--color-ink-deep`): The dark endpoint of the hero gradient (Dashboard net-worth card). Not used as text.
- **Canvas** (#f6f7f9, `--color-canvas`): Page background. Cool barely-tinted near-white — not warm, not paper.
- **Surface** (#ffffff, `--color-surface`): Card and modal fill. Pure white.
- **Surface Muted** (#f3f4f6, `--color-surface-muted`): Pressed states, secondary surfaces, inactive filter chip backgrounds.
- **Line** (#ecedf1, `--color-line`): Default borders and dividers. Extremely subtle; only visible as a hairline.
- **Line Strong** (#e2e4ea, `--color-line-strong`): Input field borders, heavier dividers.

### Asset Accents (chart and icon use only)
Funds (#6366f1), Stocks (#0ea5e9), Crypto (#f59e0b), Cash (#10b981). Used as tinted icon backgrounds (`color-mix(in srgb, accent 11%, white)`) and donut chart segment fills. Never as text color, button color, or full surface fill.

**The One Voice Rule.** Precision Indigo (#4f46e5) appears on ≤10% of any given screen. Its scarcity is the signal. No indigo surface fills, no indigo gradients, no indigo used as a general "positive action" color outside of its role as the system's primary interactive accent.

**The Earned Color Rule.** Gain, loss, and warn are financial semantics, not UI semantics. Do not use `--color-gain` for a generic "saved" confirmation or `--color-warn` for a form validation hint. The vocabulary is financial and must stay that way.

**The Asset Accent Rule.** Asset accent colors are chart and icon colors only. If a new screen needs an asset category represented, use its accent for the icon/chip only — never as the dominant color of a section or card background.

## 3. Typography

**Display Font:** Plus Jakarta Sans (extrabold 800, bold 700), with Inter and system sans-serif fallbacks
**Body Font:** Inter (regular 400 through semibold 600), system sans-serif fallback
**No third family.** Mono, serif, and script fonts are not part of this system.

**Character:** Plus Jakarta Sans carries a slight geometric warmth at display scale that fits the instrument register without tipping cold or technocratic. Its extrabold weight gives financial figures authoritative presence. Inter disappears at body size — the reader sees only the data.

### Hierarchy
- **Display** (800, 40px mobile / 52px desktop, lh 1, ls −0.025em): Hero financial figures — net worth, DCA monthly total. Plus Jakarta Sans only. Always tabular-nums. Color: `--color-ink`.
- **Headline** (800, 34px mobile / 40px desktop, lh 1, ls −0.02em): Section-level totals. Plus Jakarta Sans.
- **Title** (700, 17–22px, lh 1.3, ls −0.01em): Section headings, modal titles, medium card values (22–27px uses extrabold). Plus Jakarta Sans.
- **Body** (400–600, 14–15px, lh 1.6): List row primary text, descriptions, form field values. Inter.
- **Label** (500–600, 12–13px, lh 1.4): Captions, chip labels, metadata, nav labels. Inter. Never all-caps.

**The Tabular Rule.** Every number that might change — balances, percentages, counts, dates — uses `font-variant-numeric: tabular-nums` (via the `.tnum` utility class). No exceptions. Proportional figures on financial data cause layout jitter and break the instrument feel.

**The Two-Family Rule.** Plus Jakarta Sans is for scale — display numbers, headlines, modal and section titles. Inter is for everything else. Never use Plus Jakarta Sans for body copy, captions, or chip labels. Never use Inter as a heading font.

## 4. Elevation

The system uses ambient diffuse shadows, not structural lift. Cards float above the canvas via two-layer shadows: a tight 2px micro-shadow for edge crispness and a wide, negatively-spread diffuse halo for atmospheric separation. Shadow values use `rgba(16, 18, 27, ...)` — an ink-tinted dark, so shadows read as part of the surface rather than foreign black drops.

**The Contained Lift Rule.** Shadow lift (`--shadow-lift`) is an affordance signal, not decoration. Interactive cards respond to hover with the heavier shadow. Non-interactive surfaces — the net-worth hero card, stat cards — stay at `--shadow-soft` and never lift. Motion (the lift transition) belongs only on elements that respond to interaction.

### Shadow Vocabulary
- **Soft** (`--shadow-soft: 0 1px 2px rgba(16,18,27,0.04), 0 8px 24px -12px rgba(16,18,27,0.12)`): Default card resting state. The card is present but not demanding. The tight negative spread on the second layer keeps the halo from bleeding onto adjacent cards.
- **Lift** (`--shadow-lift: 0 2px 4px rgba(16,18,27,0.04), 0 18px 40px -20px rgba(16,18,27,0.22)`): Interactive card hover, open modal panel. Announces interactivity or elevation.

Cards combine `border: 1px solid {colors.line}` with `--shadow-soft`. This is the system's base surface register. The hairline border provides structure at zero offset; the shadow provides atmospheric depth. Do not add a third layer — a second shadow, a background tint, or a colored border — on top of this combination.

## 5. Components

### Buttons
Refined and restrained. The primary action uses deep ink in light mode and Precision Indigo (#4f46e5) in dark mode to ensure authoritative presence and high contrast.

- **Shape:** Full pill (`border-radius: 9999px`)
- **Primary (dark pill / CTA):** 
  - **Light Mode:** `background: {colors.ink}` (#0b0d12), `color: {colors.surface}` (#ffffff), `height: 40px`, `padding: 0 16px`, 14px semibold, `--shadow-soft`. Hover: `#1d2230`. Active: `scale(0.95)`. Focus: `2px solid {colors.brand}` outline at 2px offset.
  - **Dark Mode:** `dark:bg-[#4f46e5]` (Precision Indigo-600), `dark:hover:bg-[#4338ca]` (Indigo-700), `color: #ffffff`. Contrast ratio: **7.4:1 (WCAG AAA)**.
  - **Rule:** Never use light pastel lavender (`#818cf8` / Indigo-400) as a button fill with white text. Light lavender with white text only has a 2.4:1 contrast ratio, which fails accessibility standards.
- **Brand icon button:** Circle 36×36px. Resting: `background: {colors.brand-soft}`, `color: {colors.brand}`. Hover: fills to `{colors.brand}` with white icon (`dark:hover:bg-[#4f46e5]`). Used for per-row actions (Buy More on holdings).
- **Ghost icon button:** Transparent resting, `color: {colors.ink-muted}`. Hover: `background: {colors.surface-muted}`, `color: {colors.ink}`. Used for destructive/secondary row actions (trash, edit pencil).

### Filter Chips
Segment filter controls for asset class filtering, tab-like but non-destructive.
- **Inactive:** `background: {colors.surface-muted}`, `color: {colors.ink-soft}`, `border-radius: {rounded.full}`, `padding: 6px 14px`, 13px semibold.
- **Active:** 
  - **Light Mode:** `background: {colors.ink}`, `color: {colors.surface}` (#ffffff).
  - **Dark Mode:** `dark:bg-[#4f46e5]`, `color: #ffffff`.
  - Same shape and padding (`rounded-full px-3.5 py-1.5`).
- **Transition:** `background` and `color` only, 150ms.

### Cards / Containers
The primary page composition unit. Every section, metric, and list lives inside a card. No content floats directly on the canvas.
- **Corner style:** 24px radius (`--radius-card`)
- **Background:** `{colors.surface}` (pure white)
- **Elevation:** `border: 1px solid {colors.line}` + `--shadow-soft` at rest; hover interactive cards add `--shadow-lift` via `transition-shadow duration-300`
- **Padding:** 20px / 24px on `sm+` breakpoint
- **Rule:** Never nest a card inside another card.

### Stat Cards
Metric tile pattern used in the Dashboard grid: icon + label + display value + optional footer.
- **Icon container:** 36×36px, `border-radius: {rounded.sm}` (12px), `background: color-mix(in srgb, accent 11%, white)`, `color: accent`. Accent is the asset or semantic color for that metric.
- **Value scale:** Title or Display depending on context — stat cards use 24–27px; the hero net-worth uses Display.
- **Editable affordance:** Pencil icon at `opacity: 0`, transitions to `opacity: 1` on group hover. No visible edit chrome at rest.

### Inputs / Fields
- **Style:** `height: 44px`, `border-radius: {rounded.sm}` (12px), `border: 1px solid {colors.line-strong}`, `background: {colors.surface}`, 15px body text
- **Focus:** `border-color: {colors.brand}`, `box-shadow: 0 0 0 2px color-mix(in srgb, {colors.brand} 15%, transparent)`
- **Placeholder:** `color: {colors.ink-faint}`
- **Label:** 13px semibold in `{colors.ink-soft}`, 6px gap above the field
- **Number prefix (฿):** Absolute-positioned at left-3.5, same size as field text, `{colors.ink-muted}`

### Navigation
Two modes sharing identical route structure and icons; only chrome changes.
- **Bottom bar (< lg):** Frosted glass — `background: rgba(255,255,255,0.85)`, `backdrop-filter: blur(24px)`, `border-top: 1px solid {colors.line}`. Active tab: icon and label in `{colors.brand-ink}`, icon sits inside a 48×32px `{colors.brand-soft}` pill. Inactive: `{colors.ink-muted}` label and icon.
- **Sidebar (≥ lg):** Clean white left rail with `border-right: 1px solid {colors.line}`. Same active/inactive color logic, no pill background.

### Modals
- **Mobile (< sm):** Bottom sheet. `border-radius: 28px 28px 0 0`. Appears via `sheetUp` keyframe (translateY + opacity, cubic-bezier(0.16,1,0.3,1), 320ms).
- **Desktop (≥ sm):** Centered dialog, max-width 440px, `border-radius: 28px`. Same `sheetUp` animation.
- **Backdrop:** `background: rgba(11,13,18,0.35)`, `backdrop-filter: blur(4px)`, `fadeIn` 200ms ease. Clicking backdrop closes.
- **Header:** Title in 20px extrabold Plus Jakarta Sans, optional description in 13px ink-muted. Close button: 36×36px ghost icon circle.

### PnL Chips (signature component)
The primary financial signal component. Compact pill that communicates directional portfolio performance at a glance.
- **Gain:** `background: {colors.gain-soft}`, `color: {colors.gain}`. Prefix `+` on positive percent values.
- **Loss:** `background: {colors.loss-soft}`, `color: {colors.loss}`. Values render as-is (already negative).
- **Shape:** `border-radius: {rounded.full}`, `padding: 2px 8px`, 11.5–12px semibold, tabular-nums.
- **Rule:** PnL chips are data, not status badges. Do not use them for non-financial directional signals (e.g., "more than last month"). That dilutes the financial vocabulary.

## 6. Do's and Don'ts

### Do:
- **Do** use tabular-nums (`.tnum`) on every number that could change — balances, percentages, counts, unit quantities. Proportional figures are forbidden on financial data.
- **Do** keep Precision Indigo (`--color-brand`) to ≤10% of any screen surface. Its scarcity is its signal value.
- **Do** use `--shadow-soft` as the default card state and `--shadow-lift` only in response to user interaction (hover, modal open). Shadows are affordance signals, not atmosphere.
- **Do** add `@media (prefers-reduced-motion: reduce)` to every keyframe animation (`rise`, `sheetUp`, `fadeIn`, `draw`). Minimum alternative: a crossfade or instant transition. The instrument must work without motion.
- **Do** scope asset accent colors (`--color-funds`, `--color-stocks`, `--color-crypto`, `--color-cash`) to icon backgrounds and chart segments only. Tint at 11% with `color-mix` for icon containers.
- **Do** use the `.tnum` utility on all financial display values in Plus Jakarta Sans. The `font-feature-settings: 'tnum'` fallback is already in the class; lean on it.
- **Do** use Plus Jakarta Sans for hero and section titles, and Inter for body, label, and metadata text. The separation is strict.

### Don't:
- **Don't** use Precision Indigo as a surface fill, gradient, or large text block. No indigo backgrounds, no `background: var(--color-brand)` on cards or hero sections. The one exception is the primary button — and even there it uses `--color-ink`, not `--color-brand`.
- **Don't** introduce the Robinhood / crypto-app pattern: no animated price tickers, no dopamine green/red flashes on data load, no confetti or celebration animations on portfolio gains, no "you're up X% today" banners. This system observes; it does not cheer.
- **Don't** add a third typeface. Plus Jakarta Sans + Inter is the complete vocabulary. A serif, mono, or script font breaks the instrument register.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on cards, list items, or alert callouts. The system uses full borders or no border; side stripes are a different design language.
- **Don't** apply gradient text (`background-clip: text` with a gradient fill). Color is semantically earned in this system; gradient text is pure decoration with no signal value.
- **Don't** place a card inside another card. Nested cards break the elevation hierarchy and multiply shadow complexity.
- **Don't** use gain/loss/warn semantic colors outside their financial contexts. `--color-gain` is not a general "success" color; `--color-warn` is not a general "caution" color. If you need a non-financial signal state, use ink scale colors instead.
- **Don't** round cards, modals, or inputs beyond their defined radii. Cards at 24px, modals at 28px, inputs at 12px. Rounding beyond these reads as consumer-app softness, not instrument precision.

## 7. Sign-In & Landing Page Specification (Fastwork Light Theme)

The unauthenticated entry experience uses a bright, inviting **Fastwork.com-inspired Light Theme** aesthetic:

### Ambient Canvas & Atmosphere
- **Canvas Base:** `#faf6f4`
- **Ambient Gradients:**
  - Top-Left: Warm Sunrise Amber (`rgba(254, 243, 199, 0.75)` / `#fff3dd`)
  - Bottom-Right: Soft Lavender Rose (`rgba(239, 229, 232, 0.85)` / `#efe5e8`)
  - Directional Mesh: `linear-gradient(135deg, #fff3dd 0%, #faf6f4 45%, #efe5e8 100%)`

### Brand & Typography Accents
- **Logo Glyph:** Fastwork Electric Blue (`#0066FF`) rounded squircle with crisp white icon.
- **Headline Highlight Gradient:** Linear gradient flowing from **Left `#405DFF` (Fastwork Blue)** to **Right `#DFAA41` (Golden Amber)**:
  `linear-gradient(to right, #405DFF 0%, #DFAA41 100%)` with `bg-clip-text text-transparent`.
- **Status Pill:** `rounded-full bg-white/85 border border-slate-200/80` with emerald pulsating indicator.

### Sign-In Container & Action Elements
- **Card Surface:** `bg-white/95 backdrop-blur-xl rounded-[22px] sm:rounded-[24px] border border-slate-200/90 shadow-[0_12px_40px_rgba(15,23,42,0.06)]`
- **Google Sign-In CTA:** Clean white surface, 1px slate-200 hairline border, official multicolored Google SVG logo, full pill shape (`rounded-full`).
- **Guest / Local Mode CTA:** Primary Fastwork Blue pill (`bg-[#0066FF] hover:bg-[#0052cc] text-white shadow-md shadow-blue-500/25`).
- **Security Indicator:** `Secure Cloud Sync · 100% Client Privacy` aligned with hairline divider.

### Translucent Benefit Cards (3-Column Grid)
- **Container Surface:** `bg-white/60 hover:bg-white/75 backdrop-blur-md rounded-[18px] sm:rounded-[20px] border border-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)]`
- **Icon Badge:** 44×44px (`w-11 h-11 rounded-[14px]`) with Fastwork gradient fill:
  `linear-gradient(140deg, #6079FE 0%, #765EFD 50%, #B875B4 100%)` and white outlined SVG icons.
- **Content Hierarchy:** 14.5px bold title (`text-slate-800`) over 12.5px description (`text-slate-500 leading-relaxed`).

