# Theme palettes

Porcelain and Obsidian establish the reference for this revision. Porcelain uses
neutral white backgrounds with blue accents. Obsidian combines warm charcoal with
apricot. Their restrained backgrounds keep the text prominent. Porcelain is
unchanged; Obsidian joins the later softening pass across all three dark themes.

Previously, Lumina used violet throughout, Parchment used olive-tinted backgrounds,
and Midnight Fjord used plum and rose. In all three, the background, headings,
accent and syntax colors followed one hue. The replacements give backgrounds and
accents independent ramps and use secondary hues in code.

## Research and approach

[Björn Ottosson's Oklab research](https://bottosson.github.io/posts/oklab/) explains
how perceptual lightness, chroma and hue can be adjusted independently. These
palettes use OKLCH anchors, converted with Culori to sRGB hex values for CSS and
Mermaid. Out-of-gamut anchors lose chroma while keeping their lightness and hue.
CSS comments record the requested anchors before gamut mapping and hex rounding.

[Radix's scale guidance](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)
separates background, interactive-state, border and text colors by their purpose.
The reader already has semantic tokens for those roles. This revision keeps that
structure and makes selected rows, inline code and diagram notes quieter versions
of each theme's accent. Small differences between adjacent backgrounds are
intentional; readable text and visible focus indicators carry the contrast.

Three approaches were considered. A single hue gives consistency but repeats the
old palettes' limited syntax separation. A complementary or triadic scheme gives
more separation but can add unnecessary color to a long document. The chosen
approach uses a restrained background ramp, one accent and a few muted secondary
syntax colors. Their lightness is measured independently of hue.

[WCAG 2.2 contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
sets 4.5:1 for ordinary text and 3:1 for large text. These palettes target at least
4.5:1 for every tested text role, including the smaller headings and code comments.
Hue alone does not establish readability. Diff additions and deletions retain
their green/red colors and their plus/minus markers.

## Final colors

| Theme          | Background | Body text | Accent    | Character                            |
| -------------- | ---------- | --------- | --------- | ------------------------------------ |
| Lumina         | `#f7fbfa`  | `#222b2a` | `#016259` | Pale mineral, graphite, deep teal    |
| Parchment      | `#fcf6ed`  | `#312a24` | `#833941` | Warm ivory, walnut, oxblood          |
| Obsidian       | `#151313`  | `#d6d3d2` | `#dfac90` | Warm charcoal, muted apricot         |
| Midnight Fjord | `#14181b`  | `#d2d6da` | `#97c1db` | Neutral slate, mist blue             |
| Evergreen      | `#151816`  | `#d8d8d3` | `#a8c7b1` | Soft charcoal, warm gray, muted sage |

Lumina keeps its backgrounds nearly neutral. Teal marks links and selected
controls; slate blue, green and copper distinguish code functions, strings and
numbers. Its restrained teal headings remain darker than its links.

Parchment now has warm paper tones. Oxblood marks links and controls, while
headings use a darker brown-red. Pine strings, slate functions and bronze numbers
add separation without extending the red accent to every code token.

Midnight Fjord is the cool dark option beside Obsidian. Slate panels separate
controls from the near-neutral page. Mist-blue accents, sea-glass strings and
sand-colored functions provide color without turning body text bright white.

Evergreen adds a third dark option. Its near-black backgrounds carry a faint
green tint, while its body text has a little warmth. Muted sage marks links and
selected controls. Straw strings, pale blue functions and copper numbers keep
syntax distinct. The background ramp uses less chroma than the accents, so large
panels stay subdued.

## Dark palette softening

All three dark themes use near-neutral backgrounds and muted accents. The
softening pass keeps the OKLCH lightness anchors fixed and reduces chroma by role,
so the text stays readable while the page carries less color.

| Theme          | Background chroma reduction | Accent chroma reduction |
| -------------- | --------------------------: | ----------------------: |
| Obsidian       |                         60% |                     32% |
| Midnight Fjord |                         65% |                     38% |
| Evergreen      |                         70% |                     40% |

Headings, code, selected rows, borders and Mermaid colors follow the same quieter
palette. Syntax keeps distinct hues at lower chroma. The three light themes are
unchanged by this pass.

## Validation

Ratios below use the final rounded sRGB values on each page background.

| Theme          | Body text | Muted text |  Links |
| -------------- | --------: | ---------: | -----: |
| Lumina         |   13.91:1 |     6.80:1 | 6.96:1 |
| Parchment      |   13.14:1 |     6.34:1 | 7.44:1 |
| Obsidian       |   12.44:1 |     7.58:1 | 9.20:1 |
| Midnight Fjord |   12.22:1 |     7.24:1 | 9.32:1 |
| Evergreen      |   12.51:1 |     7.32:1 | 9.77:1 |

The existing `npm run check:themes` suite passes all 360 checks across six themes
and verifies agreement between CSS, manifest accents and Mermaid palettes.
An additional palette review checked headings h1 through h5, text and link roles
on normal and hovered table rows, and syntax on ordinary and focused code lines.
The lowest measured ratio in that review is 4.74:1 for Lumina's comments on a
focused line.

Browser contrast audits found no violations in the revised light or dark themes. Some
code and diagram elements need manual review because automated checks cannot
resolve their backgrounds; the token checks and rendered-page inspection cover
those separately. These checks are specific to the palette, not a claim of full
WCAG conformance for the reader.

Theme IDs and saved preferences remain compatible. Regenerate existing HTML
exports to include the new colors.
