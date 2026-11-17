# UI/UX Design System: Thai Twist Modern (brand v2)

Single source of truth for colour, type, size and motion. Code mirrors it in `src/index.css` (React, Tailwind v4 `@theme`) and the `:root` block of `api/link.js` (/link). Change the values here first, then in those two places.

### 1. Style
- **Thai twist modern**: clean, functional, bold. Thai-first labels (English second, smaller). No decorative ornament.
- **Utility first**: structure exists only to clarify what belongs together. No decorative frames, phone mock-ups, or lines that carry no meaning.
- **Spacing**: padding, gaps and margins on a 4px / 8px scale. Clean grid alignment.
- **Headings are upright**. Never italic.

### 2. Colour tokens (OKLCH in code, hex kept in comments)

Converted exactly from the brand hex values. Neutrals are tinted toward plum (hue 348) or are charcoal.

| Token | Hex | OKLCH | Use |
|---|---|---|---|
| `brand.plum` `--brand-plum` | `#41032A` | `oklch(25.18% 0.1001 348.33)` | Signature: header, hero / splash, login backgrounds, focus ring, secondary buttons |
| `--brand-plum-2` | `#571C3E` | `oklch(33.03% 0.0965 348.04)` | Raised surface / secondary button on plum |
| `--brand-plum-3` | `#6E3855` | `oklch(41.92% 0.0851 347.97)` | Hover and dividers on plum (not for text) |
| `--on-plum-2` | `#D0B5C1` | `oklch(79.98% 0.0348 349.28)` | Secondary text on plum |
| `accent.lime` `--accent-lime` | `#D0E020` | `oklch(86.55% 0.1900 114.95)` | ONE primary action per screen, always with charcoal text |
| `--accent-lime-press` | `#BBCA08` | `oklch(80.01% 0.1802 115.06)` | Pressed / hover lime |
| `charcoal` `--charcoal` | `#1A1A1A` | `oklch(21.78% 0 0)` | Ink on light surfaces; POS / bar dark theme background |
| `--charcoal-2` | `#292527` | `oklch(26.96% 0.0069 345.80)` | Dark theme raised surface |
| `--charcoal-3` | `#393436` | `oklch(33.10% 0.0078 351.28)` | Dark theme hover / pressed |
| `cream` `--cream` | `#F6F2EA` | `oklch(96.20% 0.0115 84.58)` | HR app and customer light theme surface; text on plum / charcoal |
| `--paper-2` | `#ECE4E7` | `oklch(92.60% 0.0095 352.37)` | Elevated light surface |
| `--paper-3` | `#E3D9DE` | `oklch(89.47% 0.0128 345.51)` | Image placeholders |
| `--rule` | `#D4CBCF` | `oklch(85.05% 0.0113 348.48)` | 1px dividers on light surfaces |
| `--neutral` | `#635B5F` | `oklch(48.01% 0.0120 345.78)` | Labels, helper text |
| `--muted` | `#524A4E` | `oklch(41.84% 0.0124 345.90)` | Secondary text |
| `--dark-muted` | `#BEB4B9` | `oklch(77.97% 0.0133 345.58)` | Secondary text on charcoal |
| `--dark-rule` | `#474043` | `oklch(37.96% 0.0107 349.77)` | Dividers on charcoal |
| `error.red` `--error-red` | `#B42318` | `oklch(50.03% 0.1821 29.51)` | Errors and destructive actions ONLY |

**Rules**
- **Lime** marks the single primary action on a screen (charcoal text). Never use lime as text or an outline on cream: 1.31:1.
- **Secondary actions** are plum fills (cream text) or 1px outlines (charcoal or plum). Never a second lime.
- **Red** only for errors and destructive actions. Required-field marks, prices, spice and "last order" notes are plum or charcoal.
- **No pure white or black** except charcoal `#1A1A1A`, which is part of the brand.
- **Third-party marks** keep their own colour where people look for it (LINE green, TrueMoney orange, Facebook blue), only on that service's own button.
- **`hausmade.*` namespace** (`--hausmade-orange #FF5A00`, `--hausmade-blue #0047AB`, `--hausmade-green #32CD32`, `--hausmade-dark #2A2A2A`) is ONLY for HAUSMADE products and loyalty / KEYTAG surfaces, never general UI.

**Contrast (WCAG 2.x, computed from the hex values; every text pair must be at least 4.5:1)**

| Text on surface | Ratio |
|---|---|
| charcoal on cream | 15.59:1 |
| charcoal on paper-2 | 13.94:1 |
| muted on cream | 7.68:1 |
| muted on paper-2 | 6.87:1 |
| neutral on cream | 5.89:1 |
| neutral on paper-2 | 5.27:1 |
| neutral on paper-3 | 4.78:1 |
| plum on cream | 14.79:1 |
| plum on paper-2 | 13.23:1 |
| cream on plum | 14.79:1 |
| cream on plum-2 | 11.46:1 |
| on-plum-2 on plum | 8.70:1 |
| on-plum-2 on plum-2 | 6.74:1 |
| charcoal on lime | 11.91:1 |
| charcoal on lime-press | 9.58:1 |
| lime on plum (marks) | 11.30:1 |
| error-red on cream | 5.89:1 |
| cream on error-red | 5.89:1 |
| cream on charcoal | 15.59:1 |
| cream on charcoal-2 | 13.55:1 |
| dark-muted on charcoal | 8.63:1 |
| dark-muted on charcoal-2 | 7.50:1 |
| lime on charcoal | 11.91:1 |
| **lime on cream** | **1.31:1, never** |

### 3. Type
- **SOV_monomon**: headlines only (page and section titles, hero lines). Self-hosted subset `public/fonts/sov-monomon-*.woff2`; the only font the React app preloads. It has one weight (400): never ask for bold (the `@font-face` covers 100-900 so the browser never fakes a bold).
- **IBM Plex Sans Thai**: all readable Thai and body text, buttons, item names. Self-hosted woff2, split into Thai and Latin subsets per weight in use.
- **DM Mono** (400, 500): Latin labels and numbers: prices, times, totals, counts, codes. Self-hosted woff2.
- No other families in product UI (no Geist, Switzer, Cabinet Grotesk, Inter, Space Mono, Instrument Serif). Bergen Mono is not used anywhere.
- Every webfont uses `font-display: swap`. Hero / LCP content never waits on a webfont.
- `/link` (the ads page) preloads no font: its `@font-face` rules live in `public/fonts/link-fonts.css`, linked without blocking, so font files start after the first paint. Measured 2026-11-17 (Lighthouse mobile, 3 runs): inline `@font-face` moved FCP from ~1.0s to ~1.8s, and a SOV_monomon preload alone cost ~200ms of LCP by competing with the LCP photo.

### 4. Sizes
- Body text at least 16px, POS included.
- Totals at least 24px.
- Tap targets at least 48px; POS buttons 56-64px.
- Thai line-height 1.5-1.6 (tone marks and upper/lower vowels need the room; never clip with tight line-height, fixed heights or `overflow: hidden`).

### 5. Motion
- 120-180ms, `transform` and `opacity` only (never height, margin or layout properties).
- No bounce or overshoot. Nothing loops (no pulsing, no ticking every second unless it is the last minutes of a real countdown).
- Always honour `prefers-reduced-motion: reduce` (no motion, instant state changes).
- The first paint is never animated.

### 6. Thai Thermal Receipt Printing Rules (ESC/POS & TIS-620)
- **Thermal Printhead Grid Alignment (Visual Graphemes)**: On Sunmi built-in and modern ESC/POS thermal printers with Thai TIS-620 font renderers, combining Thai vowels and tone marks (ิ, ี, ึ, ื, ุ, ู, ่, ้, ๊, ๋, ั, ็, ์) stack vertically on top of/below base consonants and consume zero horizontal character cells. Tabular grids (such as Sales Report slips with `รายการ`, `จำนวน`, `ยอดเงิน`) must calculate column widths and padding using visual graphemes (`splitPrinterGraphemes(str).length` / `visualGraphemes: true`) rather than naive byte length. This prevents jagged/wavy columns caused by differing counts of combining marks.
- **Single-Line Table Rows & Zero Text-Drop**: Table item names in multi-column grids must be kept to a single line using `formatReportItemName` and safe Thai grapheme truncation (`sliceThai`). Redundant English subtitles (e.g., `(Main Dishes)`, `(Rice Bowl)`) and bulky variant tags must be stripped so the base Thai name fits comfortably within its allocated column width (e.g. 20 cells for 36-col paper) without wrapping or dropping characters down to a second line.
- **Safe Column Limits (`maxCols`)**: Use `maxCols = 36` for 80mm thermal paper rolls (and `maxCols = 26` for 58mm rolls) to guarantee zero right-edge text clipping across all thermal printer hardware models (Sunmi built-in, Epson, Xprinter).
- **Shift Metadata Separation**: In report slips, shift metadata (date, time, staff name) must be output on individual dedicated lines (`เปิดรอบ`, `ปิดรอบ`, `พนักงาน`) to avoid awkward mid-word line breaking (such as staff names splitting across lines).
- **Kitchen & Bar Slip Separation**: Kitchen (Food) items and Bar (Drink) items must be printed as separate slips (`activeTab === 'kitchen'` and `activeTab === 'bar'`). Each slip **MUST include its own full header ticket** (`KITCHEN ORDER` / `BAR ORDER`, table name, queue #, order time, staff name) so both kitchen and bartender staff have complete order metadata.
- **Clean Slip Aesthetics & No Asterisks (`*`)**: Thermal receipts and order slips must follow a clean, minimalist Rams aesthetic. Never use decorative asterisks (such as `*** ONLINE PICKUP ORDER ***` or `***`) in header titles, banners, or divider text as it distorts alignment and looks tacky. Use bold styling (`.bold(true)` / `font-bold`), uppercase typography, or size adjustments (`.size(1, 1)` / `.size(0, 0)`) for emphasis instead.

### 7. Proactive Engineering & Advisory Principle
- **Do Not Blindly Follow Instructions Literally**: When the user requests a change or suggests parameter adjustments (e.g., margins, line widths, feed lines, cut commands), ALWAYS analyze the engineering trade-offs first. Recommend the best technical solution and explain potential side-effects (such as paper stubs, uneven margins, or right-edge clipping) instead of blindly executing literal requests to extreme values.

### 8. Hallmark Anti-AI-Slop & Zero-Icon Designer Discipline
- **Zero-Icon Priority**: Avoid decorative icons, emojis, or arbitrary vector badges. Rely strictly on pure typography, deliberate whitespace, monospace tags (`font-mono`), and clean border enclosures (`border-[var(--rule)]`).
- **Designer Handcrafted Touch**: Every modal, card, or panel must feel handcrafted by a high-end human designer — clear visual hierarchy, upright headings, subtle micro-interactions, no generic boilerplate visuals or AI Tells.
- **Hallmark Pre-Emit Critique**: All UI components must satisfy Hallmark anti-slop rules (`/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */`).

### 9. Neo-Brutalist Structural Grid (Tabular Layout)
- **Structural Headers & Tabular Layout**: When designing navigation bars, headers, or footers, prefer a brutalist tabular layout over floating pills. Use full-bleed container blocks divided strictly by 1px solid borders (`border-[var(--color-rule)]`).
- **Cellular Division**: Treat header sections (Logo, Nav Links, CTAs, Status Indicators) as distinct CSS flex/grid cells with explicit vertical/horizontal borders separating them. 
- **Banners**: Important states and marquees use a plum banner with cream text. No neon yellow.
- **CTAs**: The primary CTA is lime with charcoal text and fills its grid cell. Secondary CTAs are plum (cream text) or a 1px outline. One lime per screen.

### 10. Back-Office Audit & Reporting Policy (Mobile & Desktop)
- **Digital Sharing & Export Priority (Export PNG / PDF)**: In all back-office management interfaces (`/admin`, `AdminDashboard`, `AdminShiftsLedgerTab`, `DailySummarySlipModal`), operators and business owners access reports from personal smartphones and desktop laptops/PCs where physical thermal receipt printers (Sunmi, ESC/POS) are NOT attached.
- **Zero Thermal Print Action in Back-Office**: Do NOT place physical ESC/POS thermal printer buttons (`พิมพ์สลิป` / `PrinterIcon`) in the back-office views. Physical thermal printing is strictly reserved for front-desk point-of-sale terminals (`/pos`).
- **Standard Back-Office Actions**: Always provide digital export and sharing actions instead:
  - **Save PNG Slip**: Download full-height unconstrained PNG image via detached offscreen clone (`exportFullSlipImage`).
  - **Copy Image (LINE / Chat)**: Copy PNG image directly to clipboard for instant forwarding into LINE / messaging apps.
  - **PDF Export**: Clean vector document format or print preview for accounting and bookkeeping archives.

