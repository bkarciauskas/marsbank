---
name: Mars Bank
description: Orbital Registry identity for a fictional Mars retail bank.
colors:
  graphite: "#101518"
  mint: "#DCE8E6"
  oxide: "#E4623F"
  oxide-dark: "#C44B2C"
  signal: "#356CFF"
  muted: "#8A9694"
  line: "#3A464A"
  sidebar-rule: "#273135"
  nav-hover: "#182126"
  nav-idle: "#A9B8B5"
  paper-white: "#FFFFFF"
  dust: "#EFE6DA"
  dust-soft: "#E5D9C9"
  dust-mineral: "#D3C4B2"
  dust-muted: "#5C534C"
  dust-line: "#4A4038"
  dust-rule: "#C9B9A8"
  success: "#176B4B"
  danger: "#A62929"
  danger-bright: "#E07070"
typography:
  display:
    fontFamily: "Saira Extra Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(3.25rem, 6.4vw, 5.75rem)"
    fontWeight: 700
    lineHeight: 0.88
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Saira Extra Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(42px, 5vw, 66px)"
    fontWeight: 700
    lineHeight: 0.92
    letterSpacing: "0.02em"
  figure:
    fontFamily: "Saira Extra Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(58px, 7vw, 88px)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Saira Extra Condensed, Arial Narrow, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "0.03em"
  wordmark:
    fontFamily: "Saira Extra Condensed, Arial Narrow, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.18em"
  body:
    fontFamily: "Saira, Helvetica Neue, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Saira Extra Condensed, Arial Narrow, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.1em"
rounded:
  none: "0px"
  sm: "2px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "28px"
  xl: "32px"
components:
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.mint}"
    rounded: "{rounded.none}"
    padding: "0 18px"
    height: "48px"
  button-outline-hover:
    backgroundColor: "{colors.oxide}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.none}"
    padding: "0 18px"
    height: "48px"
  button-primary:
    backgroundColor: "{colors.oxide}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.none}"
    padding: "0 20px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.oxide-dark}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.none}"
    padding: "0 20px"
    height: "48px"
  button-register-transfer:
    backgroundColor: "{colors.oxide}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.none}"
    padding: "0 22px"
    height: "52px"
  nav-sidebar-idle:
    backgroundColor: "transparent"
    textColor: "{colors.nav-idle}"
    rounded: "{rounded.none}"
    padding: "0 22px"
    height: "58px"
  nav-sidebar-active:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.none}"
    padding: "0 22px"
    height: "58px"
  input-underline:
    backgroundColor: "transparent"
    textColor: "{colors.graphite}"
    rounded: "{rounded.none}"
    padding: "10px 2px 11px"
    height: "auto"
  input-register:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.none}"
    padding: "0 13px"
    height: "48px"
---

# Design System: Mars Bank

## Overview

**Creative North Star: "The Orbital Registry"**

Mars Bank plots frontier finance as survey work, not as a conservative card stack and not as a space-game HUD. Public, login, and authenticated pages sit on the same graphite coordinate sheet: Macquarie-like information architecture, film-balanced hero, orbital-arc lockup, then a continuous register. Survey mint is type and the active rail, not a second ground. One palette, one condensed display face, and one-pixel rules.

The memorable banking moment is a single plotted register. The available total, every account column, and the movement rail use the same numeral language, so the customer reads the whole bank as one exact coordinate instead of a pile of product cards.

**Key Characteristics:**
- Dark graphite ground or light dust paper; mint type on graphite, graphite type on dust; oxide for action; signal for coordinates, totals, and focus
- One-pixel survey rules instead of nested cards and soft elevation
- Saira Extra Condensed for lockup, headings, and money; Saira for body and metadata
- Orbital-arc ellipse lockup with an oxide node and signal ticks
- Sharp corners on register surfaces; the only circles are the mark and small avatars

## Colors

Four working colors plus muted ink. Dark mode (default) uses graphite as page ground and mint as type. Light mode uses dust paper (`#EFE6DA`) and graphite ink — the same mineral sheet as the terrain, not a mint invert. Oxide never swaps. Signal darkens to `#2454D6` on dust so plotted amounts keep contrast. The hero survey plate, utility bar, banking rail, and mobile tab bar stay graphite in both modes. Mint remains type and the active rail pill, never a second ground.

### Primary
- **Oxide**: Filled and outline actions, the orbital node, account reference numerals, and the overview transfer control. Darken to oxide-dark on hover for filled actions.

### Secondary
- **Signal**: Available totals, available column amounts, sol headings, credit amounts, summary figures, and the 2px focus ring. Do not fill large public surfaces with it.

### Neutral
- **Graphite**: Dark page ground, sidebar, hero plate, and public chrome that stays dark in both modes.
- **Survey mint**: Body and display on graphite, inverse wordmark, and the active sidebar pill. Not a light-mode fill.
- **Dust**: Light-mode page ground, register stage, and the active rail punch. Warm regolith paper, not green survey stock.
- **Muted**: Metadata, product names, held labels, and idle chrome. Dust-muted (`#5C534C`) on light paper.
- **Line**: Hairlines on graphite (`#3A464A`) for public cells and the register.
- **Sidebar rule**: Hairlines inside the graphite rail only.
- **Nav idle / nav hover**: Unselected sidebar type and hover wash.
- **Paper white**: Active sidebar pill and customer avatar only.
- **Success / danger**: Transfer confirmation and form errors. Use danger-bright (`#E07070`) for errors on graphite. Credits in the movement rail use signal, not success.

### Named Rules
**The Signal Coordinate Rule.** Signal is for plotted values and focus. Oxide is for doing. Graphite is ground. Mint is type on graphite. Dust is light paper. Do not reintroduce Macquarie blue fills or mint as a light canvas.

**The Survey Ink Rule.** Structure the register with 1px line rules on graphite. Do not nest white cards, drop shadows, or 8–10px content radii on authenticated ledgers.

## Typography

**Display Font:** Saira Extra Condensed (Arial Narrow)
**Body Font:** Saira (Helvetica Neue)

**Character:** Condensed display is the survey instrument: uppercase, tight leading, wide tracking on labels. Body stays regular Saira so metadata can sit under a plotted name without competing.

### Hierarchy
- **Display** (700, public hero clamp): Public coordinate-sheet headlines only.
- **Headline** (700, banking intro clamp, uppercase): Authenticated page titles such as the greeting line.
- **Figure** (600, position-band clamp, signal): The available total and other register-scale money.
- **Title** (600, 28px, uppercase): Account register, movement rail, and summary headings.
- **Wordmark** (600, 22px, 0.18em, uppercase): Lockup type beside the orbital mark.
- **Body** (400, 16px / 1.5): Sentences, login copy, transfer help.
- **Label** (11–12px, 0.1em, uppercase condensed): Column headers, sol stamps, unit lines.

Account names sit at 19px condensed uppercase. Available amounts in rows sit at 20px condensed signal. Held and total columns in the same row stay mint.

### Named Rules
**The Condensed Money Rule.** Money, page titles, and column headers use Extra Condensed. Do not set balances in italic serif or in regular Saira at display size.

## Layout

Public IA stays Macquarie-like: 32px-class utility bar, 78px primary nav, 1240px `public-width`, split hero (copy ~42% / field remainder), four-cell explore row, three service columns. The hero seam is a 28px 45-degree graphite diamond.

Authenticated shell is a 228px sticky graphite rail plus the same graphite stage. Content width is `min(1280px, calc(100% - 48px))` with 32px top padding. Overview order is greeting and sol, full-width position band, then a `2.15fr / 0.85fr` registry (account ledger left, dated movement right), then a matching two-column summary. Account rows share a seven-track grid: 42px ref, name, branch/number, available, held, total, 18px arrow.

Breakpoints in the build: 1180px stacks the registry and summary; 1100px tightens public grids and the rail; 850px hides the desktop sidebar, shows a 68px graphite tab bar, and collapses account rows; 560px further compresses type and card panels.

### Named Rules
**The Shared Column Rule.** Every visible account on a register view shares one column set. Do not give each product its own card layout.

## Elevation & Depth

Login sits on the public graphite plate with hairline rules and no card shadow. Authenticated ledgers are flat: position band, sections, callouts, and transfer split sit on graphite with hairlines and `box-shadow: none`. Physical bank-card faces are the exception: 2px corners and `0 16px 28px rgba(16, 21, 24, 0.16)` because they depict an object, not a content container.

Focus is a 2px signal outline with 3px offset. Reduced motion collapses transitions and animation to 0.01ms.

### Named Rules
**The Flat Register Rule.** Ledger surfaces do not lift. If a control needs emphasis, change fill (oxide) or ink (signal), not shadow.

## Shapes

Corners are 0px on register chrome, buttons, fields, and sidebar items. Identity radius is 2px (`--radius`) for the drawn bank-card silhouette only. Circles are reserved for the orbital mark (36px public / 28px on cards), 34px customer avatar, and small transaction marks. Sidebar active state is a mint (dark) or dust (light) rectangle with a 1px oxide inset on the inner edge.

Public explore cells and service bands are ruled rectangles, not rounded tiles.

### Named Rules
**The One Circle Rule.** Circles belong to the lockup and avatars. Do not round the register, the position band, or form controls.

## Components

### Buttons
- **Shape:** Square (0px). Public outline and register transfer stay square; do not restore leftover 7–8px radii from earlier banking CSS.
- **Public outline:** 1px oxide, mint type, min-height 44–48px, Extra Condensed uppercase. Hover fills oxide and flips type to graphite.
- **Primary fill:** Oxide, white type, used on login submit and transfer confirm. Hover oxide-dark.
- **Register transfer:** Oxide fill, graphite type, min-height 52px, in the position band. Hover oxide-dark with white type.
- **Ghost restore:** 1px line, mint type, 12px body; hover fills mint and flips type to graphite.

### Cards / Containers
- **Public:** Graphite ground, 1px line cells, mint hover invert on explore links.
- **Login plate:** Transparent on graphite, 520px, 1px line rules, no shadow.
- **Register sections:** Transparent graphite, 1px line rules, 24px/28px gutters, no radius.
- **Bank-card object:** Graphite or oxide-dark face, 2px radius, 1.58 ratio, faint orbital ring.

### Inputs / Fields
- **Login:** Bottom rule only (`1px` line), mint type, no box.
- **Transfer:** 1px line box, 0 radius, 48px height, transparent on graphite; amount field at 22px with a unit suffix.
- **Focus:** 2px signal outline, 3px offset, on buttons, links, inputs, and selects.

### Navigation
- **Public:** Centered 12px uppercase tracked links; 2px oxide underline on hover. Utility bar is `#0B1012`.
- **Sidebar:** 228px graphite, inverse wordmark, Extra Condensed 16px uppercase rows at 58px, 1px sidebar-rule separators. Active is mint + graphite type + oxide inset. Hover wash is nav-hover.
- **Top bar:** Graphite, 60px, “Orbital registry” condensed label, 12px utility actions.
- **Mobile banking:** Fixed 68px graphite bar, four equal tabs, oxide + bold when active.

### Wordmark
Orbital-arc lockup in `components/brand/wordmark.tsx`: rotated ellipses, graphite or mint stroke, oxide node, signal axis ticks. Pair with Extra Condensed “MARS BANK”. Inverse (mint) on every graphite surface.

### Coordinate Register
Greeting plus sol line (28px condensed). Position band is a full-width line-ruled band: signal label, signal figure, oxide transfer. Account register uses shared columns; available figures are signal, held/total mint. Movement rail dates in condensed uppercase; credits in signal. Summary rows continue the same hairline grammar.

## Do's and Don'ts

### Do:
- **Do** keep public IA Macquarie-like and swap identity to Mars Bank + orbital lockup.
- **Do** keep login and authenticated work on the same graphite plate as the public site, with a graphite rail and 1px survey rules.
- **Do** plot totals and available money in signal Extra Condensed.
- **Do** use oxide for the only primary action on a view (login, transfer, freeze secondary stays outline).
- **Do** label synthetic balances as model tokens.
- **Do** stack the account register above the movement rail below 1180px; keep the mobile tab bar.

### Don't:
- **Don't** use sci-fi HUD glow, planet globes, or game chrome.
- **Don't** put a kicker or eyebrow above a headline.
- **Don't** rebuild the overview as a stack of conservative bank-product cards.
- **Don't** fill public or register fields with Macquarie-like blue blocks.
- **Don't** round register containers or rely on card shadows for hierarchy.
- **Don't** set display type in italic serif.
