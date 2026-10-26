---
name: Spendiary
description: A private money app for one person in Thai Baht. Spend tracks daily money; Invest tracks holdings, DCA plans, dividends and cash.
source-of-truth: "The code. Token values live in src/index.css; this file describes them and the rules for using them. When the two disagree, fix this file."
reference-module: "Spend (src/modules/spend). When Spend and Invest do the same job differently, Spend's way is the standard."
primary-theme: "Light. Design and review every screen in light first; dark must follow from tokens alone."
colors:
  # Light theme (default). Dark values are listed under colors-dark.
  canvas: "#faf9f5"            # under the ambient gradient (body, .app-canvas-bg)
  surface: "#ffffff"
  surface-muted: "#f4f6fa"
  ink: "#090d16"
  ink-hover: "#1a202c"
  ink-soft: "#334155"
  ink-muted: "#555b6a"
  ink-faint: "#6b7280"
  ink-deep: "#1e293b"
  line: "#eaedf3"
  line-strong: "#dbe2ec"
  brand: "#0066ff"
  brand-soft: "#eef4ff"
  brand-ink: "#0052cc"
  invest: "#0066ff"
  invest-soft: "#eef4ff"
  invest-ink: "#0052cc"
  spend-accent: "emerald-700 (text) / emerald-600 (fill)"
  gain: "#059669"
  gain-soft: "#ecfdf5"
  loss: "#e11d48"
  loss-soft: "#fff1f2"
  warn: "#d97706"
  warn-soft: "#fffbeb"
  funds: "#2563eb"
  stocks: "#0284c7"
  crypto: "#f97316"
  gold: "#eab308"
  real-estate: "#a855f7"
  cash: "#10b981"
  debt: "#f43f5e"
colors-dark:
  canvas: "#0f1117"
  surface: "#181b26"
  surface-muted: "#1f2235"
  ink: "#eef0f8"
  ink-soft: "#b0b8d0"
  ink-muted: "#8390a8"
  ink-faint: "#8a93a8"
  line: "#242839"
  line-strong: "#2c3048"
  brand: "#4f46e5"
  brand-soft: "#1e2245"
  brand-ink: "#c7d2fe"
  invest: "#0066ff"
  invest-ink: "#4d94ff"
  gain: "#34d399"
  loss: "#fb7185"
  warn: "#fbbf24"
typography:
  families:
    display: "'Plus Jakarta Sans', Inter, 'IBM Plex Sans Thai', ui-sans-serif, system-ui, sans-serif"
    body: "'Inter', 'IBM Plex Sans Thai', ui-sans-serif, system-ui, sans-serif"
    mono: "ui-monospace only for <kbd> keys and the build hash in the footer"
  scale:
    2xs: "12px. The floor: tight badges, chart axis labels"
    xs: "13px. Captions, chips, list metadata, field hints"
    sm: "14px. List row titles, buttons, field labels, secondary body"
    base: "16px. Body copy, input text"
    lg: "18px. Card titles"
    xl: "20px. Modal titles"
    3xl: "30px. Page titles (24px on phones)"
    4xl: "36px. Hero figures inside a card"
rounded:
  chip: "9999px"
  button: "9999px"
  input: "12px (rounded-xl)"
  icon-tile: "12px (rounded-xl)"
  inset: "16px (rounded-2xl)"
  card: "24px (--radius-card)"
  modal: "28px"
spacing:
  card-padding: "20px (p-5)"
  card-padding-compact: "16px (p-4), stat tiles in a grid only"
  modal-gutter: "24px (px-6)"
  page-gutter: "20px phone / 32px sm / 40px lg"
components:
  button-primary:
    background: "{colors.ink}"
    darkBackground: "{colors-dark.brand}"
    text: "#ffffff"
    rounded: "{rounded.button}"
    height: "44px (md) / 36px (sm)"
  field:
    background: "{colors.surface}"
    border: "{colors.line-strong}"
    rounded: "{rounded.input}"
    height: "44px"
  card:
    background: "{colors.surface}"
    border: "{colors.line}"
    shadow: "--shadow-soft"
    rounded: "{rounded.card}"
    padding: "{spacing.card-padding}"
  modal:
    background: "{colors.surface}"
    rounded: "{rounded.modal}"
    widths: "sm 400px / md 460px / lg 620px"
---

# Design System: Spendiary

## 1. Ground rules

1. **The code is the source of truth.** Token values live in `src/index.css`. This file explains them and sets the rules for using them. If you change a token, update this file in the same commit.
2. **Light theme comes first.** Every screen is designed and reviewed in light. Dark mode is still supported, but it must come from tokens alone: no hex values and no hand-written `dark:` colours in components (section 8).
3. **Spend is the reference.** The Spend module was built to this system. Invest is being brought in line with it. When the two do the same job differently, copy Spend.
4. **One way to do each thing.** One modal, one card, one button set, one list row, one way to confirm a delete. If a screen needs something new, add it to the shared component and to this file. Don't build a one-off.
5. **No emoji in the interface.** Icons come from `src/components/icons` (lucide). This covers labels, titles, buttons, select options, toasts, empty states and section headers. Use the text characters `·`, `→`, `−` and `฿` as punctuation; they are not emoji.

## 2. Overview

**North star: "The Control Room."** Spendiary is a private money app for one person. It is calm, exact and quiet. Numbers carry the screen, and colour only appears when it means something.

- Warm off-white canvas with a soft ambient gradient (light); flat `canvas` in dark.
- White cards with a hairline border and a soft shadow. Every block of content lives in a card.
- Plus Jakarta Sans for titles and big numbers; Inter for everything else. Neither has Thai glyphs, so IBM Plex Sans Thai sits after them in both stacks and draws only the Thai text.
- Phones get a bottom nav and bottom-sheet modals. Desktop (lg and up) gets a fixed sidebar and centred modals. The structure of a page never changes between the two, only the chrome around it.

## 3. Colour

### Brand and sides
- **Brand** (`--color-brand`): electric blue `#0066ff` in light, indigo `#4f46e5` in dark. Use it for focus rings, selected states, progress bars and solid fills with white text. Never as a card or section fill.
- **Brand-coloured text is `text-link`** (`--color-link`: `#005ce8` light, `#818cf8` dark), never `text-brand`: indigo text on the dark surface reads at 2.7:1. `link` keeps 5:1 or better on every surface in both themes. `lint:design` rejects `text-brand`.
- **Two sides, two accents.** Spend is emerald (`SPEND_ACCENT_TEXT` in `src/components/tones.ts`); Invest is blue (`--color-invest`, the same in both themes). Side colour appears only in the Spend/Invest switch, the page eyebrow and the active nav item. It is not used to style cards or buttons.

### Neutrals
`ink` carries most text. Use `ink-soft` for field labels and row values, `ink-muted` for captions and metadata, and `ink-faint` for placeholders and disabled text. Use `line` for card borders and dividers, and `line-strong` for input borders.

### Semantic colours
- **gain / loss / warn** mean money going up, money going down, and something due or at risk. Use the `-soft` tint for backgrounds, the full colour for bars, fills, dots and chart strokes, and the **`-ink` colour for text and icons** (`text-gain-ink`, `text-loss-ink`, `text-warn-ink`). The full colours read at only 2.9–3.8:1 as text on white; the `-ink` ones (the 700 shades in light, unchanged in dark) keep 4.5:1 or better. `lint:design` rejects bare `text-gain` / `text-loss` / `text-warn`.
- The same three colours are also used for **result feedback** (success and error toasts, the result popup) and **due states** (due today, overdue).
- They are **never button fills for a normal save**. A green "Add to holding" or "Confirm" button is wrong; use the primary button. The only coloured button is `danger`, and only for destructive actions.
- **White text on a colour needs a non-flipping token.** `gain` and `loss` turn light in dark mode, so `bg-gain text-white` goes unreadable. Use `bg-danger` (delete buttons, nav count badges) and `bg-gain-strong` / `hover:bg-gain-strong-hover` (selected month chips, "Log buy", "Mark received", done markers).
- **Spend's shared pastels** live in `tones.ts`: `STATUS_TONE` (the day's allowance: on track / careful / over), `ATTENTION_TONE` (Today stack: late, due soon), `TAG_CHIP` (#tags) and `SPENT_TONE` (money spent in Analysis, orange so it never reads as a loss). Reuse them; don't write the pastel again.

### Category tones and asset accents
- **Category tones** (`TONES` in `src/components/tones.ts`) are pastel pairs for Spend categories. Use them for category icon tiles, selected category tiles, subcategory trays and chart bars, and nothing else.
- **Categorical badges** on the Invest side (debt types, activity-log kinds) use `TINT` / `tintBadge()` from `tones.ts`. They tell kinds apart; they don't mean good or bad.
- **Asset accents** (`--color-funds`, `-stocks`, `-crypto`, `-gold`, `-real-estate`, `-cash`, `-debt`) are for chart segments, legend dots and asset icon tiles only. They are never text colour, button colour or a section fill.

### What not to use
- No raw Tailwind palette colours (`emerald-600`, `rose-500`, `amber-400`, …) in components. The only exceptions are `tones.ts` (which holds every pastel set, so Tailwind can see the full class names), the test-mode banner and sidebar TEST badge (bright amber in both themes on purpose), and `AssetLogo`. The landing page uses its own `landing-*` tokens (section 10). `npm run lint:design` enforces this.
- No hex values in `className`. If a colour is missing, add a token in `src/index.css`. The only exception is third-party brand marks: bank and fund logos in `AssetLogo`, and social glyphs.
- Solid action fills use `bg-primary hover:bg-primary-hover text-white`, never `bg-ink`. `ink` flips to near-white in dark, so `bg-ink text-white` turns unreadable.

## 4. Typography

| Role | Class | Used for |
|---|---|---|
| Page title | `font-display text-2xl sm:text-3xl font-extrabold tracking-tight` | `PageHeader` only |
| Hero figure | `font-display text-4xl font-extrabold tracking-tight tnum` | The one big number in a card (Today, Total net worth) |
| Modal title | `font-display text-xl font-extrabold tracking-tight` | `Modal` only |
| Card title | `font-display text-lg font-extrabold` | The heading row of every card |
| Stat value | `font-display text-2xl font-extrabold tnum` | Values in stat tiles |
| Row title | `text-sm font-semibold text-ink` | List rows |
| Body | `text-sm text-ink-muted` | Descriptions, empty-state copy |
| Label / meta | `text-xs font-semibold text-ink-muted` | Small section labels inside a card, row metadata |
| Field label | `text-sm font-semibold text-ink-soft` | Above every input (`Field`) |

Rules:
- **Sentence case everywhere.** Write "Add holding", not "Add Holding"; "Remove dividend record", not "Remove Dividend Record". This covers titles, buttons, labels, menu items and command palette entries. Proper nouns and tickers keep their case.
- **All caps is only for the page eyebrow** in `PageHeader` (`text-xs font-semibold uppercase tracking-[0.08em]`) and the date eyebrow on Spend Home. Never use uppercase labels inside cards: write "Portfolio value", not "PORT VALUE".
- **`.tnum` on every number that can change**: money, percentages, counts, dates.
- **Nothing under 12px.** No arbitrary sizes like `text-[11px]`.
- **Inputs are 16px on phones** (the rule in `src/index.css`), or iPhone Safari zooms in.
- **Mono** is used only for `<kbd>` keys and the build hash.

## 5. Elevation and motion

- **`--shadow-soft`**: every card at rest.
- **`--shadow-lift`**: modals and popovers, and the hover state of a card that is a link or button. Nothing else lifts.
- Cards are a hairline `border-line` plus `--shadow-soft`. Don't add a second shadow, a tinted background or a coloured border on top.
- **Motion vocabulary** (all defined in `src/index.css`, all covered by `prefers-reduced-motion`):
  - `sheetUp` (320ms) for modals and sheets
  - `fadeIn` (200ms) for backdrops
  - `rise` (`.animate-rise`) for content appearing
  - `pop` and `result-card-in` for the result popup
- **Utilities:** `animate-fade-in` (backdrops, inline errors), `animate-sheet-up` (dialogs and sheets) and `animate-pop-in` (desktop dropdowns and menus), defined in `@theme`.
- Only use animation names that exist in `src/index.css`. Class names from other libraries (`animate-in`, `zoom-in-95`, `animate-fadeIn`) do nothing here.

## 6. Components

### 6.1 Buttons (`src/components/ui/Button.tsx`)
| Variant | Use |
|---|---|
| `primary` | The one main action. Ink in light, `brand` in dark. |
| `secondary` | Second choices beside a primary ("Export current data first", "Set budget"). |
| `ghost` | Cancel in a confirm dialog; quiet inline actions. |
| `danger` | The confirm button of a destructive action. |
| ~~`success`~~ | Deprecated. Use `primary`. |

- **Shape:** always a pill. Sizes are `md` (44px, the default for footers) and `sm` (36px, inside cards and headers).
- **Text links:** `TextLink` (`text-sm font-semibold text-link hover:underline`), like the "Manage" link on Spend Home. Use an arrow (`→`) only when the link leaves the page. Name the destination: "See analysis →", "Portfolio →".
- **Row actions:** `IconButton` (ghost, or brand for "buy more"). A small row confirm such as "Paid" is a `sm` pill in primary.
- **Don't build buttons by hand.** A raw `<button>` with `bg-ink text-white` means `Button` is missing a feature; add it there instead.

### 6.2 Cards (`src/components/ui/Card.tsx`)
There is one card: `Card` (`src/components/ui/Card.tsx`, along with `CardHeader` and `Inset`). Don't build card-like boxes by hand.

**Anatomy, top to bottom:**
1. **Header row** (optional): `CardHeader`. The card title is on the left (`font-display text-lg font-extrabold`), with an optional one-line description below it; one `TextLink` or one `sm` button sits on the right. No icon tile before the title.
2. **Body**: a hero figure, a list (`divide-y divide-line`), a chart, or a form.
3. **Footer line** (optional): one `text-xs text-ink-muted` line, or a "Coming up" style sub-list above a `border-t border-line`.

**Padding:** `p-5`. The only other sizes are:
- `<Card compact>` (`p-4`): stat tiles in a grid, and one-line link cards.
- `<Card list>` (`px-4 sm:px-5`, no vertical padding): a card that is just divided rows, which set their own rhythm.

No per-page padding overrides. A card whose inside is a full-bleed chart or table uses `padded={false}` and pads its own sections.

**Interactive cards:** if the whole card is a link or button, add `hover:shadow-[var(--shadow-lift)] transition-shadow`. Otherwise it never lifts.

**Inside a card, never nest another card.** For grouped content, use one of two inner surfaces:
- **Inset** (`<Inset>`): `rounded-2xl bg-surface-muted p-4`, with no border and no shadow. Use it for a group of figures inside a card, such as portfolio value plus all-time PnL.
- **Dashed prompt:** `rounded-2xl border border-dashed border-line-strong p-3`. Use it for empty or setup prompts ("Set up bills that repeat").

**Picture tiles are the one exception:** the credit-card stack (`CardStack`) and the wallet tiles on Spend → Accounts draw the object itself (a card face, a wallet), so they keep their own shape and accent ring.

**Stat tiles** are a grid of `Card compact`. Each tile has a label (`text-xs font-semibold text-ink-muted`), a value (stat value style), and an optional one-line note. Long values must fit or be shortened (`฿140.0K`). A chip must never overflow its tile.

**Attention cards** (Spend Home's "3 payments due"): `TodayStack` is the only pattern for "something needs you". It is a tinted `rounded-2xl` row with an icon tile, a title, a meta line and a `Review` pill. Invest uses the same component.

### 6.3 List rows
This is the Spend row (`TxnRow`, `RecurringDue`), used on both sides:
- **Left:** a 40px icon tile (`h-10 w-10 rounded-xl`), tinted with the category tone or the asset accent at about 11%.
- **Middle:** the title (row title style, truncates) over a meta line (`text-xs text-ink-muted`; warn or loss colour only for a due state).
- **Right:** the amount (`text-sm font-bold tnum`) and/or one action.
- **Spacing:** rows are `py-3` inside `divide-y divide-line`. No borders around single rows.

### 6.4 Chips
- **Filter chip** (`FilterChip`, `DropdownChip`): 30px pill; `surface-muted` when off; `ink` (light) or `brand` (dark) when on.
- **Status chip:** `rounded-full px-2.5 py-0.5 text-xs font-bold` in a semantic soft tint ("On track", "Due today").
- **PnL chip** (`PnL`): gain or loss soft tint, `tnum`, with a `+` on positive values. Use it for money only.
- **Tag chip** (`#nosetea`): `brand-soft` background, `brand` text.
- **Quick-pick chips** above a field (Today / Yesterday) are filter chips, not brand-filled pills.

### 6.5 Inputs (`src/components/ui/Field.tsx`)
- **Field:** 44px high, `rounded-xl`, `border-line-strong`, filled `bg-surface-muted`. On focus it turns `bg-surface` and the border turns `brand` with a 2px `brand/15` ring.
- **Native control icons:** date, time and select arrows are lucide `Calendar` / `Clock` / `ChevronDown` drawn by `src/index.css`; search clear buttons and number spinners are hidden there too. Don't add your own chevron to a select.
- **Label:** above the field, `text-sm font-semibold text-ink-soft`, with a 6px gap. An optional hint sits on the right of the label row.
- **Every input uses the shared look:** the `TextField` / `NumberField` / `SelectField` components, or `FieldWrap` (the label row) around a plain control styled with `fieldClass` from `src/components/ui/fieldClasses.ts`. Don't copy the class string, and don't give one field a different fill.
- **Optional fields** show `hint="optional"` on the label row, not "(optional)" in the label.
- **Fields side by side** (`grid grid-cols-2`) use `items-end`, so a label that wraps to two lines on a phone can't push its input out of line. A hint that doesn't fit drops to its own line whole; keep notes that go under an input out of side-by-side rows, or bottom alignment lines those up instead.
- **Option groups:** `SegmentedControl` for 2–4 options; a select or `Popover` list for more.

### 6.6 Modals: one shell (`src/components/ui/Modal.tsx`)
Every dialog in the app is a `Modal`, including confirmations, pickers on phones and the keyboard-shortcuts screen. Users learn one shape and see it everywhere.

**Shell**
- **Phone (below sm):** a bottom sheet. Corners are 28px at the top only, and there is **no grab handle**: the sheet can't be dragged, so a handle would promise something it doesn't do.
- **Desktop:** a centred dialog with 28px corners.
- **Widths:** `sm` 400px for confirms and single-field dialogs; `md` 460px, the default for forms; `lg` 620px only for tables and previews (CSV import, AI import). There is no larger size.
- **Backdrop and motion:** `bg-ink/35` with `backdrop-blur-sm`; `fadeIn` on the backdrop and `sheetUp` on the panel. Tapping the backdrop or pressing Esc closes the dialog.
- **Focus:** focus is trapped inside, the page behind doesn't scroll, and focus returns to the opener on close. You get all of this for free by using `Modal`.

**Header**
- **Title:** sentence case, a verb and an object, ideally 30 characters or fewer. "Pay KTC", "Edit loan", "Delete this account?".
  - Put context (which location, which holding) in the description, not after a dash in the title. Write "Buy more" with the description "Goes into Vault A", not "Buy more — Vault A".
- **Description** (optional): one or two sentences in `text-sm text-ink-muted`. Use it only when it tells the user something the form doesn't.
- **Close:** the 44px round ✕, on every modal.

**Footer: exactly three patterns**

| Pattern | Use for | Layout |
|---|---|---|
| **A. Form** (`FormActions`) | Add or edit something | When editing: a 2-tap delete bin on the left. Then a full-width primary button. |
| **B. Action** | One-shot actions (pay, log, move, import, apply search) | One full-width primary button: `FormActions` with `submitLabel`, or a full-width `Button data-modal-submit`. |
| **C. Confirm** (`ConfirmModal`) | Destructive or irreversible actions | A stacked full-width confirm (`danger` or `primary`) over a `ghost` Cancel. |

Footer rules:
- **No Cancel button in A or B.** The ✕, Esc and the backdrop already cancel.
- **The primary label says what happens:** "Add", "Save changes", "Pay ฿1,200", "Log ฿5,000 buy", "Import 12 transactions". For a destructive confirm, name the thing: "Delete account", not "Confirm".
- **The primary button is `primary`**, never green and never a hand-built colour. Sell is not destructive; it uses `primary` with a clear label.
- **A disabled primary must have a visible reason:** a field error, or `FormActions`' `hint` line above the button ("Enter an amount"). Don't leave a grey button unexplained.
- **`FormActions` takes `submitLabel`** for anything more specific than "Add" / "Save changes".
- **Enter submits:** every footer marks its main button `data-modal-submit`, so Enter in a text field submits.

**Choosing how to confirm a delete**
- **Inside an edit form:** use the 2-tap bin (pattern A). It's quick, and the form gives the context.
- **Anywhere else** (a list row, a menu, a bulk delete, reset, undo, replace data): use `ConfirmModal` (pattern C).

**Body layout:** `space-y-5` between groups. Inside a modal, a group gets an inset (`rounded-2xl bg-surface-muted`), never a bordered card. Section toggles inside long forms are plain text rows with a chevron and no emoji.

**Pickers and menus (`Popover`)**
- **Phone:** they open in the same bottom-sheet shell and header as `Modal`.
- **Desktop:** they open as a dropdown under the button: `rounded-2xl border-line bg-surface p-1.5 shadow-[var(--shadow-lift)]`. Options are `PopoverOption`.
- **Row "⋯" menus** (holding and location menus) are `Popover` lists too, with neutral item colours. "Sell" is not red and "Buy more" is not green: the icon carries the meaning.
- Group options with `PopoverDivider`. An action that can't run right now is a disabled `PopoverOption` with a short `hint` ("Locked"), not a hidden item.
- Desktop dropdowns open below their button, or above it when that fits better.

**Command palette:** the one placement exception. It is anchored near the top so the phone keyboard doesn't cover the results, and it has no header. It shares the modal surface, 28px radius, backdrop and `sheetUp` motion. The keyboard-shortcuts screen opens as a normal `Modal` (`sm`).

### 6.7 Feedback
- **Toast** (`showToast`): small confirmations and Undo. Its action button is a `sm` primary pill (ink), the same as every other primary.
- **Result popup** (`ResultOverlay`): money moves where the amount matters (pay, log a buy, sell, dividend). Errors and warnings wait for "Got it"; success closes itself.
- **Confetti:** milestones only (a loan paid off, a goal reached), not every save.
- **Empty states:** `EmptyState` with a lucide icon and one action. Inside a card, a dashed prompt row (6.2) also works.

### 6.8 Page structure
- **Header:** every page starts with `PageHeader`: eyebrow, title, optional subtitle, optional action on the right, optional Guide button. Spend Home uses the date as its eyebrow and the greeting as its title.
- **Layout:** a page is a stack or grid of `Card`s, with the page gutter on each side. No content floats directly on the canvas, apart from the header and banners.
- **Banners** (offline rate, sync conflict): a full-width `rounded-2xl` row in a semantic soft tint, with a lucide icon and one sentence.

### 6.9 Navigation
- **Sidebar (lg and up):** a white rail with `border-r border-line`. At the top is the Spend/Invest switch (each half in its own side accent), then grouped links with an uppercase group label. The active item gets a soft tint of its side colour.
- **Bottom bar (below lg):** `bg-surface/85 backdrop-blur-xl border-t border-line`. The active tab's icon sits in a `brand-soft` pill. Spend's bar has a centre "+" for Quick add; Invest's does not.
- **"More" opens a `Modal`** with one row per destination: icon tile, title, one-line description, chevron.

## 7. Icons
- Use lucide icons through `src/components/icons` only. Stroke icons, sized `h-4 w-4` in buttons and chips and `h-[18px] w-[18px]` in row tiles.
- **No emoji anywhere in the interface:** not in labels, options, toasts, badges, section headers or empty states. Text glyphs (`·`, `→`, `−`, `✓` drawn as an icon) are fine when they are punctuation, not decoration.
- **Text exports are not interface.** The Markdown export (`src/lib/portfolioMarkdown.ts`) may keep its own formatting.

## 8. Dark mode
Dark mode is supported, but it comes second. It must work without component-level colour work:
- Use tokens only (`bg-surface`, `text-ink`, `bg-brand`, …). They flip on `.dark`.
- **No `dark:bg-[#4f46e5]`-style hex values.** The primary button colour is a token (`--color-primary` / `--color-primary-hover`: ink in light, indigo in dark).
- A `dark:` class is allowed only to pick a different **token**, for example `dark:bg-brand`.
- **Check light first, then dark**, at phone width (375–430px) and desktop width (1280px and up).

## 9. Do and don't

**Do**
- Reuse `Modal`, `ConfirmModal`, `FormActions`, `Card`, `Button`, `Field`, `Popover`, `EmptyState` and `PageHeader`.
- Write sentence case, name the action on the button, and put context in the description.
- Use `.tnum` on every changing number.
- Test light first, then dark, on a phone and a desktop.

**Don't**
- Build a dialog, card, button or input by hand.
- Use emoji.
- Put a card inside a card, or give inner boxes their own border and shadow.
- Use green or any custom colour for a normal save button.
- Use uppercase labels inside cards.
- Use hex colours or raw Tailwind palette colours in components.
- Use animation class names that aren't defined in `src/index.css`.
- Use gradient text or coloured side stripes on cards.

## 10. Sign-in and landing page
The signed-out pages (`src/app/Landing.tsx` with `EmailCodeSignIn.tsx`, and `/privacy` in `Privacy.tsx`; shared `LandingFooter.tsx`) are invite-only, written in Thai, and **light only**. They use the `landing-*` tokens, which are never overridden by `.dark`, so a visitor whose saved theme is dark still sees them light. The plan behind them is `docs/landing-redesign-plan.md`.
- **Mood:** warm and pastel, not bare. Calm still applies: no motion, no stats, no claims that aren't true.
- **Canvas:** `.landing-canvas-bg`, the same warm cream-to-rose gradient as the light app canvas.
- **Pastel pairs:** `landing-mint` / `-mint-ink` for Spend, `landing-sky` / `-sky-ink` for Invest, `landing-lavender` / `-lavender-ink` for invite and privacy, `landing-peach` for the Demo button. Fill with the soft colour; put text and icons in the `-ink` colour.
- **Hero:** a lavender invite pill with a lock icon, the heading with a mint highlighter under its last line, then the description. The sign-in card sits on the right (lg and up); on phones it comes straight after the description and must sit above the fold at 375×812.
- **Sign-in card:** `landing-glass` (translucent white) with `backdrop-blur-xl`, a white hairline border, `--shadow-landing-soft`, 28px corners. Google sign-in is the one dark pill (`landing-ink`); Demo is a peach pill. Links are `landing-link`.
- **Product panels:** one 32px pastel panel per side (mint Spend, sky Invest) with a label chip, a title, one line on what it covers, and a real demo-mode screen cropped by the panel's bottom edge (`public/landing/`, retaken with `npm run landing` in `promo/`). A lavender strip below links to the privacy policy.
- **Thai copy:** write it the way a Thai speaker would say it ("เข้าสู่ระบบด้วย Google", "นโยบายความเป็นส่วนตัว", "เวอร์ชัน 1.x"), never word for word from English. Pages set `lang="th"`; wrap loanwords and short phrases the browser would split (คริปโต, ยังไง, งบประมาณ) in `<Keep>` (`src/app/Keep.tsx`).
