# UI/UX Design Aesthetics (Dieter Rams + Thai Modern)

All user interfaces in this project must be designed following a clean, minimalist style inspired by **Dieter Rams** combined with a **Thai Modern** OKLCH color palette.

### 1. Dieter Rams Minimalist Structure & Type
- **Utility & Clarification**: Visual structure must exist only to clarify functional relationships. No decorative browser frames, phone frames, or unnecessary lines.
- **Grids & Spacing**: Use clean grid alignments. All padding, gaps, and margins must align strictly with a 4-pixel or 8-pixel spacing scale.
- **Typography pairing (The 2+1 Rule)**:
  - **Display / Headings**: Use functional grotesque sans-serifs such as `Cabinet Grotesk` or `General Sans` (Fontshare) / `Geist` (Google Fonts). Avoid banned defaults (*Inter*, *Roboto*).
  - **Body Text**: Use highly readable, neutral sans-serifs like `Switzer` (Fontshare) or `Geist` (Google Fonts).
  - **Outlier**: Use a single monospace font (e.g., `Geist Mono` or `JetBrains Mono`) for labels, tags, and small figures. Limit the outlier to at most 2 distinct slots per page.
  - **Headings Style**: Headings must always be upright (Roman). Never italicize display headers.

### 2. Thai Modern Color System (OKLCH Only)
- **Chroma & Tinted Grays**: No pure black or pure white. All grays must be tinted toward the anchor warm hue (Chroma >= 0.005) to maintain visual harmony.
- **Palette Tokens (Anchor Hue: 28 - Terracotta Clay)**:
  - `--color-paper`: `oklch(97% 0.008 28)` (Warm cream/sand surface)
  - `--color-paper-2`: `oklch(94% 0.010 28)` (Elevated surface)
  - `--color-rule`: `oklch(85% 0.012 28)` (Subtle warm dividers)
  - `--color-neutral`: `oklch(55% 0.010 28)` (Secondary text & helper tags)
  - `--color-muted`: `oklch(42% 0.010 28)` (Muted captions)
  - `--color-ink`: `oklch(18% 0.012 28)` (Primary text / high-contrast reading)
  - `--color-accent`: `oklch(52% 0.16 28)` (Clay Terracotta / แดงดินเผา)
  - `--color-accent-2`: `oklch(45% 0.08 140)` (Olive Banana-Leaf / เขียวใบตองแห้ง)
  - `--color-focus`: `oklch(60% 0.15 28)` (Accessible highlight ring)
- **Accent Footprint**: Primary colors/accent fills should cover at most 3% to 5% of any viewport. The accent functions as a highlighter or marker, not a block layout fill.

### 3. Thai Thermal Receipt Printing Rules (ESC/POS & TIS-620)
- **TIS-620 Byte Length Calculation**: In ESC/POS text printing mode, every character byte in `str.length` consumes 1 physical character cell on the thermal printhead. **Do NOT filter out combining Thai vowels or tone marks** (such as ิ, ี, ึ, ื, ุ, ู, ่, ้, ๊, ๋) when calculating column widths or padding strings (`padEnd`). Always calculate wrapping (`wrapTextByWords`) and padding based on exact `str.length` (byte count) to prevent line overflow and price right-edge text wrapping (`.00` / `.-` falling to the next line).
- **Safe Column Limits (`maxCols`)**: Use `maxCols = 36` for 80mm thermal paper rolls (and `maxCols = 26` for 58mm rolls) to guarantee zero right-edge text clipping across all thermal printer hardware models (Sunmi built-in, Epson, Xprinter).
- **Kitchen & Bar Slip Separation**: Kitchen (Food) items and Bar (Drink) items must be printed as separate slips (`activeTab === 'kitchen'` and `activeTab === 'bar'`). Each slip **MUST include its own full header ticket** (`KITCHEN ORDER` / `BAR ORDER`, table name, queue #, order time, staff name) so both kitchen and bartender staff have complete order metadata.
- **Clean Slip Aesthetics & No Asterisks (`*`)**: Thermal receipts and order slips must follow a clean, minimalist Rams aesthetic. Never use decorative asterisks (such as `*** ONLINE PICKUP ORDER ***` or `***`) in header titles, banners, or divider text as it distorts alignment and looks tacky. Use bold styling (`.bold(true)` / `font-bold`), uppercase typography, or size adjustments (`.size(1, 1)` / `.size(0, 0)`) for emphasis instead.

### 4. Proactive Engineering & Advisory Principle
- **Do Not Blindly Follow Instructions Literally**: When the user requests a change or suggests parameter adjustments (e.g., margins, line widths, feed lines, cut commands), ALWAYS analyze the engineering trade-offs first. Recommend the best technical solution and explain potential side-effects (such as paper stubs, uneven margins, or right-edge clipping) instead of blindly executing literal requests to extreme values.

### 5. Hallmark Anti-AI-Slop & Zero-Icon Designer Discipline
- **Zero-Icon Priority**: Avoid decorative icons, emojis, or arbitrary vector badges. Rely strictly on pure typography, deliberate whitespace, monospace tags (`font-mono`), and clean border enclosures (`border-[oklch(85%_0.012_28)]`).
- **Designer Handcrafted Touch**: Every modal, card, or panel must feel handcrafted by a high-end human designer — clear visual hierarchy, upright headings, subtle micro-interactions, no generic boilerplate visuals or AI Tells.
- **Hallmark Pre-Emit Critique**: All UI components must satisfy Hallmark anti-slop rules (`/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */`).

### 6. Neo-Brutalist Structural Grid (Tabular Layout)
- **Structural Headers & Tabular Layout**: When designing navigation bars, headers, or footers, prefer a brutalist tabular layout over floating pills. Use full-bleed container blocks divided strictly by 1px solid borders (`border-[var(--color-rule)]`).
- **Cellular Division**: Treat header sections (Logo, Nav Links, CTAs, Status Indicators) as distinct CSS flex/grid cells with explicit vertical/horizontal borders separating them. 
- **High Contrast Accent Banners**: Use a bright, high-contrast banner (e.g., Neon Yellow `#E9F344` or Thai Modern Accent) with uppercase monospace text to denote important states or decorative marquees.
- **Stark CTAs**: Use stark background color contrast for Primary CTAs (e.g., solid `var(--color-ink)` with paper-colored text) that fill their entire grid cell.
