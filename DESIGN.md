# Design

Visual system for the pdy reader (`assets/styles`, `assets/themes`). Typography is frozen and
not covered here: Studio Feixen Sans, Geist Mono, Noto Sans Sinhala, their weights, the weight
adjustment mechanism, body size and line height, inline and block code sizes.

## Direction

A quiet editorial reading surface. Neutral tinted greys, one restrained accent per theme,
hairline borders, few surfaces, one radius scale. Chrome (TOC, toolbars, fold arrows, anchors,
copy buttons) stays muted until hovered, focused, or needed. Structure comes from spacing and
type size, not rules, colour, or boxes. Reference: the owner's Gloss app (shadcn new-york,
Phosphor line icons) and the calm reading surfaces of Notion and ChatGPT.

Rules that hold everywhere:

- Headings are ink-coloured, never accent-coloured. No rules under headings.
- Body text is left-aligned, never justified.
- Accent at full strength appears only for: links, the current TOC entry, the selected theme,
  checked tasks, focus rings, the progress bar, diagram note borders, and the fold chevron and
  heading anchor while hovered.
- Accent at reduced strength (a `color-mix` toward neutral, tokens below) appears in exactly
  three places: list markers and ordered numbers, the blockquote rule, and the callout hairline.
  Nothing else gets a tint. Never headings, body text, table rules, code surfaces, or fills.
- Left bars: only blockquotes have one (1px). Callouts, TOC, and lists use fills.
- Selected state everywhere is `accent-subtle` fill plus accent text.
- Elevation is declared once. In-flow surfaces use a border only. Floating layers (popovers,
  sheets, drawers, floating buttons, maximized views) use `--shadow-float`, which includes its
  own hairline ring, and no separate border.

## Tokens

Defined in `assets/styles/base.css` (shared) and `assets/themes/css/<id>.css` (per theme).

| Role | Token | Use |
| --- | --- | --- |
| Page | `--color-bg` | Document background |
| Raised | `--color-surface` | Popovers, sheets, floating buttons, steppers |
| Tint | `--color-surface-alt` | Callouts, hovered controls, settings tiles |
| Hover | `--color-hover` | Row, line, and list hover |
| Hairline | `--color-border` | Every divider and in-flow border |
| Control edge | `--color-border-strong` | Inputs, checkboxes, diagram node borders |
| Ink | `--color-text`, `--color-heading`, `--color-strong` | Body, headings, bold |
| Quiet ink | `--color-text-muted` | Metadata, TOC, captions, labels, markers |
| Accent | `--color-accent`, `-hover`, `-subtle`, `--color-on-accent` | See rules above |
| Accent, softened | `--accent-marker` (62% accent, 38% muted ink), `--accent-rule` (42% accent, 58% control edge), `--accent-hairline` (24% accent, 76% hairline) | List markers, blockquote rule, callout border |
| Code | `--color-code-*`, `--code-*` | Recessed code and diagram surface, syntax colours |

Themes keep their ids, names, and light/dark split. Neutrals are tinted to the theme hue
(chroma <= 0.016). Each accent is one hue at chroma 0.06-0.09.

| Theme | Mode | Identity |
| --- | --- | --- |
| Porcelain | light | White and neutral grey, slate ink, steel-blue accent |
| Lumina | light | Pale mineral, deep teal accent |
| Parchment | light | Warm ivory, brown-black ink, oxblood accent |
| Obsidian | dark | Warm charcoal, apricot accent |
| Midnight Fjord | dark | Slate, mist-blue accent |
| Evergreen | dark | Soft charcoal, sage accent, warm grey text |

**Spacing** (`--space-*`): 0.25, 0.5, 0.75, 1, 1.5, 2, 3rem. Tight groups 0.5rem, related
blocks 1rem, block separation 1.5rem, sections 2.25rem above a heading and 0.75rem below.

**Radii**: `--radius-sm` 4px (inline code, keycaps), `--radius-md` 6px (buttons, inputs,
checkboxes), `--radius-lg` 8px (code, tables, diagrams, callouts, popovers, floating buttons),
`--radius-xl` 12px (sheets and drawers).

**Motion**: `--ease-feedback` cubic-bezier(0.2, 0, 0, 1) for hover and press at 120ms;
`--ease-reveal` cubic-bezier(0.16, 1, 0.3, 1) for panels at 200-350ms. No springs, no bounce.
Everything collapses under `prefers-reduced-motion`.

**Icons**: Phosphor line style, 16px in controls, 14px in text, `currentColor`; stroke icons
are normalised to 1.6px. An icon set beside text is centred on the text's first line box and
raised by `--icon-lift` (0.035em) to the cap centre. The fold chevron and heading anchor are as
tall as the heading's line box (`1lh`), so they follow every heading level, text size, and weight. **Hit targets**: pointer UI may be 32px; on `pointer: coarse` every
control is at least 44px.

## Components

- **Headings**: h1 1.8em, h2 1.4em, h3 1.2em, h4 1.1em, h5 1em, h6 0.85em muted. Weight is the
  frozen heading weight at every level. Anchor and fold controls are muted icons that appear on hover.
- **Header**: title, then one muted line: author, date, reading time. Reading time is plain
  text with an icon, not a pill.
- **Lists**: one indent (1.5em) for bullets, numbers, and tasks. Markers use `--accent-marker`. Task
  checkboxes sit in the marker column, 1em, 4px radius, accent fill when checked.
- **Blockquote**: 1px left rule in `--accent-rule`, muted text, no fill. **Callout** (`aside`):
  `surface-alt` fill, `--accent-hairline` border, 8px radius, no bar.
- **Code**: `code-bg` recessed block, hairline border, 8px radius, no shadow. Line numbers are
  quiet, with no divider. Copy is a ghost chip shown on hover. "Show More" sits below the block,
  never over its border.
- **Tables**: no outer grid and no zebra. Row hairlines only, muted header with a stronger rule
  under it, frame on the scroll container. Expand and rotate sit above the table (inside the
  toolbar row when maximized), never over cells.
- **Diagrams**: `code-bg` surface, one toolbar row with a muted title and ghost icon buttons.
- **TOC**: no panel and no band. Muted title, ghost "Expand all / Collapse all", links with one
  indent step per level, active entry on a filled row. Drawer on compact screens.
- **Floating controls**: TOC and appearance toggles share one 44px, 8px-radius button. Open state
  is a tint, never a ring.
- **Appearance panel**: sentence-case muted section labels, theme tiles with a swatch, steppers
  of one width with the same minus glyph. The value column is `7ch`, `nowrap`, tabular numerals,
  wide enough for "1160px", so values never wrap. Button hover fills follow the control's inner radius.
- **Lightbox, shortcuts, maximized views**: `--modal-backdrop-background`, `--shadow-float`.
- **Footer**: hairline, muted credit line.
- **Print**: light tokens, chrome hidden, folds opened, code wraps, tables fit.

Respected preferences: reduced motion, increased contrast (hairlines become muted ink),
forced colors (borders restored, selected states outlined), print.
