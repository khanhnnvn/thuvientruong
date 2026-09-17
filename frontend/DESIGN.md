---
name: Thư viện Trường học
description: Bảng tin lớp học ghim màu — hệ thống quản lý thư viện trường học đa trường, tiếng Việt.
colors:
  paper: "#f3e9d6"
  paper-light: "#faf5ec"
  paper-white: "#fffdf9"
  ink: "#2b2621"
  ink-soft: "#6d6152"
  ink-faint: "#a99d8a"
  board-blue: "#3e7cb1"
  board-blue-dark: "#2c5a80"
  board-orange: "#e8963c"
  board-orange-dark: "#b06a1e"
  board-brick: "#c1502e"
  board-brick-dark: "#953b21"
  board-green: "#6b8f5c"
  board-green-dark: "#4c6740"
  system-ink: "#232019"
  system-ink-soft: "#33302a"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 4vw, 3rem)"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.01em"
  body:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.board-blue-dark}"
    textColor: "{colors.paper-white}"
    typography: "{typography.display}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.board-green-dark}"
    textColor: "{colors.paper-white}"
    typography: "{typography.display}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-danger:
    backgroundColor: "{colors.board-brick-dark}"
    textColor: "{colors.paper-white}"
    typography: "{typography.display}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink}"
    typography: "{typography.display}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  badge-status:
    backgroundColor: "{colors.board-orange-dark}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  card:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
  stat-card-hero:
    backgroundColor: "{colors.board-brick-dark}"
    textColor: "{colors.paper-white}"
    typography: "{typography.display}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
---

# Design System: Thư viện Trường học

## Overview

**Creative North Star: "Bảng Tin Lớp Học" (The Classroom Notice Board)**

The whole product reads as one oversized classroom cork board, not a white-and-blue SaaS dashboard. Every feature, status, and emphasis point is a solid, decisive block of color pinned to the board — never a translucent tinted chip, never a hairline-outlined card pretending to be neutral. Marketing surfaces (landing, registration) sit on the warm cork tone at full saturation; operating surfaces (dashboard, tables) move to a tighter cream-white so a thủ thư staring at the screen for hours gets density without losing the world's warmth. The system explicitly refuses the generic "headline left, app screenshot right, three feature bullets" layout that every other school-management product uses.

The signature device is the **pinned note**: a rounded block, a small circular "pin" dot straddling its top edge, a layered offset+blur shadow, and a slight ±1–2° rotation. It ships today in exactly three places — the landing page's live-notification cards, the landing feature strip, and the dashboard's oversized hero stat card — driven by one shared mechanism (`.animate-pin-in` + the `--pin-rotate` CSS custom property + the pin-dot span markup), not three copy-pasted one-offs.

Status and data density are handled with the same conviction: four solid "board-marker" colors carry one fixed meaning everywhere in the system, and data tables keep real ruled gridlines like a printed timetable rather than the hidden-border minimal tables generic dashboards default to.

**Key Characteristics:**
- Warm cork/paper grounds, never a cool gray or pure white.
- Four solid, saturated board-marker colors, each with one fixed system-wide meaning — no pastel/tinted status chips.
- The pinned-note device (pin-dot + tilt + layered offset shadow) as the one recurring signature motif, used sparingly for emphasis, not everywhere.
- Ruled, gridded data tables — a deliberate rejection of the hidden-border "quiet" SaaS table.
- Plus Jakarta Sans (display) + IBM Plex Sans (body/data), both loaded with the Vietnamese diacritic subset.

## Colors

A warm, saturated palette: cork/cream grounds, charcoal-brown ink, and four fully-opaque "board marker" accents that never appear tinted or pastel.

### Primary
- **Board Blue** (`#3e7cb1`, dark fill `#2c5a80`): the system's default interactive color — primary button fill, focus-visible outline (`:focus-visible`), links, and the catalog/books meaning wherever status or feature color is needed.

### Secondary
- **Board Orange** (`#e8963c`, dark fill `#b06a1e`): mượn/trả (borrow-return) and any `pending` state; also the text-selection color (`::selection`).
- **Board Brick** (`#c1502e`, dark fill `#953b21`): overdue, fines, warnings, and the negative lifecycle states (`rejected`, `suspended`, `lost`, `damaged`).
- **Board Green** (`#6b8f5c`, dark fill `#4c6740`): reservations, and the positive/completed lifecycle states (`approved`, `returned`, `ready`, `fulfilled`, `paid`).

### Neutral
- **Cork Paper** (`#f3e9d6`): the marketing/persuade ground (landing, registration).
- **Light Paper** (`#faf5ec`): the default body background for operating/high-density screens (dashboard, tables).
- **Paper White** (`#fffdf9`): card, table-row, input, and modal surfaces — a near-white that still reads warm, never a cool `#fff`.
- **Ink** (`#2b2621`): primary text.
- **Soft Ink** (`#6d6152`): secondary text — tinted brown, deliberately never a desaturated gray.
- **Faint Ink** (`#a99d8a`): tertiary text, placeholders, disabled/faint icons.
- **System Ink** (`#232019`, secondary surface `#33302a`): the super-admin area's chrome — same warm-charcoal family, one shade graver, used for its full-bleed dark header/body instead of the light paper ground.

### Named Rules
**The Fixed Meaning Rule.** Each board-marker color carries exactly one meaning everywhere it appears — blue = sách/danh mục (books/catalog), orange = mượn/trả + pending, brick = quá hạn/phạt/cảnh báo + rejected/suspended, green = đặt trước/hoàn tất + approved. `StatusBadge`'s status→tone map, `StatCard`'s `tone` prop, and the landing feature-strip color assignments all follow this mapping — apply the same mapping when adding any new status or feature-tone assignment, never invent a fifth accent hue.

**The Solid Fill Rule.** Board-marker colors appear as full-opacity fills with white text (`bg-board-*-dark text-paper-white`), never as a tinted/pastel background with colored text — except the small `StatCard` (`size="sm"`) icon chip, which is the one place a low-opacity tint (`bg-board-*/12–16`) is used deliberately to stay quiet next to the oversized hero stat.

**The Warm Neutral Rule.** Every neutral — ground, text, or divider — is tinted brown from the ink/paper family. No pure gray or pure white appears anywhere in the palette.

## Typography

**Display Font:** Plus Jakarta Sans (with `ui-sans-serif, system-ui, sans-serif` fallback)
**Body/Data Font:** IBM Plex Sans (with `ui-sans-serif, system-ui, sans-serif` fallback)

**Character:** A confident, rounded geometric display face over a workmanlike, highly legible text face built for dense data tables and tabular numerals (`font-variant-numeric: tabular-nums` applied globally via `.tnum`).

Both families are loaded via `next/font/google` with the `latin` **and** `vietnamese` subsets. The direction contract's original suggestion (Outfit for display, DM Sans for body) was deliberately replaced: neither ships a `vietnamese` glyph subset, so Vietnamese diacritics would silently fall back to a system font. This is a hard constraint, not a style preference — the entire interface is Vietnamese-language (per PRODUCT.md).

### Hierarchy
- **Display / Hero** (Plus Jakarta Sans, 800, `text-4xl`→`text-5xl`, `leading-[1.08]`, `tracking-tight`): landing H1 only.
- **Headline** (Plus Jakarta Sans, 700, `text-2xl`, `tracking-tight`): page-level H1 on every operating screen (dashboard, borrow, etc.).
- **Title** (Plus Jakarta Sans, 600, `text-base`): `CardTitle`, modal titles.
- **Stat — large** (Plus Jakarta Sans, 800, `text-3xl`→`text-4xl`, tabular): the one oversized hero number per screen (`StatCard size="lg"`).
- **Stat — small** (Plus Jakarta Sans, 700, `text-xl`, tabular): secondary stat rows.
- **Body** (IBM Plex Sans, 400–500, `text-sm`/`text-base`, `leading-relaxed`): paragraph copy, table cells, form values.
- **Label** (Plus Jakarta Sans, 600–700, `text-xs`, `uppercase`, `tracking-wide`): used sparingly — table column headers, the hero stat's label line, and the dashboard "Lối tắt" section heading. Not used as a decorative kicker above headlines.

### Named Rules
**The Tabular Numerals Rule.** Any number that lines up in a column or reads as a counted quantity (table dates, currency, stat values) carries `.tnum` (`font-variant-numeric: tabular-nums`), applied globally at the `body` level plus explicitly on stat/table cells.

## Layout

Marketing pages use a `max-w-7xl` container with `px-6 sm:px-8` side gutters; operating screens live inside the app shell's own content width. The landing first viewport is a 12-column grid (`lg:grid-cols-12`): 7 columns for the pitch + CTA + slug-login form, 5 columns for the pinned-notification cluster — the dashboard hero reuses the same 7/5 split for its oversized stat vs. secondary stats. Section rhythm on operating screens is `space-y-6` (24px) between page header, filters, and content card.

Spacing follows Tailwind's default 4px scale, applied consistently rather than through a bespoke spacing token — the direction contract called for "một đơn vị nhịp baseline duy nhất" (a single custom baseline unit); the shipped `@theme` block defines no `--spacing-*` overrides, so the actual rhythm is disciplined reuse of Tailwind's stock steps (`gap-2`/`gap-3`/`gap-4`/`gap-5`/`gap-6`, `p-4`/`p-5`/`p-6`), not a custom unit.

Responsive behavior: the landing hero and feature strip collapse to a single column below `lg`; every ruled data table switches to a stacked-card list below `sm` rather than horizontally scrolling a shrunken table (`hidden ... sm:block` table + `sm:hidden` card list, seen identically in `borrow/page.tsx`).

## Elevation & Depth

Depth comes from one deliberate shadow vocabulary — a real offset plus a soft blur, layered as two shadows per step — never a flat 0-blur "neobrutalist" hard shadow and never an ambient-only glow. Structural surfaces (plain cards, modals) sit at a lower step than the pinned emphasis blocks.

### Shadow Vocabulary
- **pin-sm** (`1px 2px 0 rgba(43,38,33,.08), 0 3px 8px -4px rgba(43,38,33,.22)`): resting buttons, small inputs/forms, the pin-dot itself.
- **pin** (`2px 4px 0 rgba(43,38,33,.1), 0 10px 22px -10px rgba(43,38,33,.28)`): default card elevation, hover state of primary buttons, toasts.
- **pin-lg** (`3px 6px 0 rgba(43,38,33,.12), 0 20px 38px -14px rgba(43,38,33,.32)`): the pinned-note device (landing notices, feature strip, hero stat card) and modals.

### Named Rules
**The Real Offset Rule.** Every shadow pairs a hard-edged, non-blurred offset layer with a soft blurred ambient layer underneath. A shadow with only blur (generic ambient elevation) or only a hard offset (flat neobrutalist block shadow) is not this system's vocabulary.

## Shapes

- **8px** (`rounded-lg`): inputs, selects, textareas, small icon buttons (close/dismiss controls).
- **12px** (`rounded-xl`): buttons, small `StatCard`, quick-link pills, the tab-strip container.
- **16px** (`rounded-2xl`): cards, modals, the large hero `StatCard`, pinned-note blocks (landing notices, feature strip), the empty/error state containers.
- **full** (`rounded-full`): badges, the pin-dot marker, the pinned-note's circular "pin."

Borders are a thin `border-ink/10` on structural cards, stepping up to `border-2 border-ink/12–20` on emphasis containers (inputs, the tab strip, the landing slug-login form, feature-card wrappers) and to `border-b-2 border-ink/20` on ruled-table header rows. Rotation is reserved for the pinned-note device only (`-2deg` to `1.5deg`, via `--pin-rotate`); structural cards, tables, and forms are never rotated.

## Components

### Buttons
- **Shape:** 12px radius (`rounded-xl`), `font-display font-semibold tracking-tight`.
- **Primary:** solid `board-blue-dark` fill, `paper-white` text, `shadow-pin-sm` at rest → `shadow-pin` + darker fill on hover, presses down 1px (`active:translate-y-px`) and drops back to `shadow-pin-sm`.
- **Secondary:** identical mechanics on `board-green-dark`.
- **Danger:** identical mechanics on `board-brick-dark`.
- **Outline:** `paper-white` fill, `border-2 border-ink/20`, no shadow — used for the secondary action beside a primary button.
- **Ghost:** transparent, `ink-soft` text, `hover:bg-ink/[0.06]` — used for dismiss/cancel actions inside modals.
- Sizes: `sm` (32px), `md` (40px, default), `lg` (48px).

### Badges (StatusBadge)
- **Style:** solid pill (`rounded-full`), fixed-meaning fill per the Fixed Meaning Rule above; `neutral` variant is an outlined `border-ink/20` label with no fill, reserved for roles and non-lifecycle labels (never borrows a status color).

### Cards / StatCard
- **Corner Style:** 16px (`rounded-2xl`) for `Card`; small `StatCard` uses 12px (`rounded-xl`).
- **Background:** `paper-white`.
- **Shadow Strategy:** `Card` sits at `shadow-pin`; the small `StatCard` has none (relies on its `border-ink/10` instead); the large hero `StatCard` is the pinned-note device at `shadow-pin-lg`.
- **Internal Padding:** header/body at `px-5 py-4` (20/16px).
- **The one-per-screen rule:** `StatCard size="lg"` is the single oversized emphasis block per screen — used exactly once (dashboard hero); every other stat on that screen renders at `size="sm"`.

### Inputs / Fields
- **Style:** `rounded-lg`, `border-2 border-ink/15`, `paper-white` background.
- **Focus:** border shifts to `board-blue` plus a `board-blue/20` ring — the one place blue appears purely as an interaction cue rather than a books/catalog label.
- **Disabled:** `bg-ink/5`, `text-ink-faint`.

### Ruled Data Table (shared pattern, not a shared component)
- **Header:** `bg-paper border-b-2 border-ink/20`, cells divided by `divide-x divide-ink/15`, `text-xs uppercase tracking-wide text-ink-faint`.
- **Body rows:** `divide-x divide-ink/10 border-b border-ink/12`, tabular numerals on every date/currency cell, a tinted `bg-board-brick/[0.04]` row wash for overdue rows.
- **Mobile:** the table is hidden below `sm`; a `divide-y` stacked card list replaces it — never a horizontally-scrolled shrunken table.
- **Known drift:** this exact markup is hand-duplicated across six files (`fines`, `reservations`, `books/[id]`, `borrow`, `users`, super-admin's school list) rather than factored into a shared `<Table>` component. Treat the pattern above as the system rule to follow on new tables; treat the duplication itself as a defect to fix by extraction, not a pattern to keep re-copying.

### Pinned Note (signature component)
The world's one recurring emphasis device: a solid board-marker fill, a `paper-white` circular pin-dot (`h-4 w-4 rounded-full shadow-pin-sm`) positioned `absolute -top-2 left-6`, a `shadow-pin-lg`, a slight rotation via the `--pin-rotate` CSS custom property, and a settle-in animation (`.animate-pin-in`, 620ms, translateY+scale+rotate). Shipped in exactly three places: the landing page's live-notification cards, the landing feature strip, and the dashboard's hero `StatCard`. Reserved for marketing/hero emphasis — not used on structural or data-dense UI.

## Do's and Don'ts

### Do:
- **Do** use the layered `pin-sm`/`pin`/`pin-lg` shadow pair (real offset + soft blur) for anything meant to read as part of this world; never a flat 0-blur hard shadow or a blur-only ambient glow.
- **Do** keep the four board-marker colors' meanings fixed system-wide when adding any new status or feature-tone assignment (blue=books, orange=borrow/pending, brick=overdue/danger, green=reservations/approved) — follow the existing convention even though it is not yet enforced by a shared mapping utility.
- **Do** keep data tables ruled and gridded (`divide-x`/`divide-y`, `border-b-2` header rule) rather than switching to a hidden-border minimal table.
- **Do** load any new typeface only from a family that ships a Vietnamese (`vietnamese`) Google Fonts subset.
- **Do** keep every neutral warm-tinted (ink/paper family); never introduce a true achromatic gray.

### Don't:
- **Don't** add a fifth solid accent hue — the four board-marker colors (+`-dark` variants) are exhaustive.
- **Don't** render a status or feature tone as a tinted/pastel chip; board-marker colors are solid fills with white text, except the small `StatCard` icon chip.
- **Don't** copy the ruled-table markup into a seventh file — it is already duplicated six times with no shared component; extract before adding a new instance.
- **Don't** apply the pinned-note device (pin-dot + tilt + `shadow-pin-lg`) to structural or data-dense UI (tables, forms, nav); it is reserved for marketing/hero emphasis and appears in exactly three places today.
- **Don't** rotate anything other than a pinned-note block — cards, tables, and forms stay axis-aligned.
