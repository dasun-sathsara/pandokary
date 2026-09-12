# Reader audit

September 12, 2026

## Purpose and constraints

Pandokary wraps Pandoc to turn Markdown into portable HTML documents. The Go CLI resolves and bundles assets, a Lua filter prepares the document, and the browser scripts add reading controls. Its main job is reading technical notes, including code, diagrams, math, tables, and images.

This pass builds on the edits already present in the working directory. It preserves Studio Feixen Sans, Geist Mono, the Sinhala fallback, heading scales, document widths, spacing, and the existing sidebar and floating-control arrangement. Changes concern visual treatment, reader behavior, and unnecessary work during export and loading.

## Glass research

Apple describes glass as a layer for controls and navigation above content, with more opacity for larger panels to preserve legibility. This fits the appearance popover, floating buttons, image close control, and mobile contents drawer. It does not call for making paragraphs or code translucent. [Apple: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)

CSS `backdrop-filter` affects pixels behind an element and needs a partially transparent background. Nested filtered ancestors also change what a child can sample. The implementation uses a single bounded filter per floating panel, without nested button filters or full-screen backdrop blur. [MDN: backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter)

Blur has a rendering cost. The reader uses a fixed 12px blur, 94% opaque theme surfaces, a small highlight, and the existing theme shadow. It does not animate blur or keep diagram layers permanently promoted with `will-change`. Opaque backgrounds remain the default when filtering is unsupported. [web.dev: backdrop-filter](https://web.dev/articles/backdrop-filter)

Reduced transparency and increased contrast switch the glass controls back to solid theme surfaces. Reduced-motion behavior remains in place. Forced colors use native checkboxes and explicit selected-state outlines. [MDN: prefers-reduced-transparency](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-transparency)

## Theme selection

| Theme | Character | Accent |
| --- | --- | --- |
| Lumina | Cool light canvas with neutral content surfaces | Green, `#107a40` |
| Parchment | Warm paper canvas and soft cream surfaces | Terracotta, `#9d4627` |
| Obsidian | Near-black canvas and neutral raised panels | Violet, `#a08aff` |
| Midnight Fjord | Dark navy canvas with blue-gray panels | Cyan, `#68d1fc` |

The six retired CSS palettes and their Mermaid JSON files are removed. The template, Lua asset lists, appearance options, manifest, and diagram fallback logic now agree on the four supported themes.

Saved Primer, Verdant Paper, and Lilac Frost preferences migrate to Lumina. Studio Dark and Ayu Mirage migrate to Obsidian. Boreal migrates to Midnight Fjord. Invalid values fall back to Lumina before the first paint, rather than leaving the reader without color tokens.

## Findings and changes

| Area | Finding | Change |
| --- | --- | --- |
| Controls | Floating controls, viewer buttons, and image close controls used different border and background treatments. | Shared finish tokens, bounded glass, consistent button borders and corners, and visible copy-success styling. |
| Links | Persistent link underlines differed by theme. | The same underline treatment now identifies prose links in every theme. |
| Appearance | Saved retired themes could leave the page without a matching palette; text-size percentages assumed an 18px base. | Early theme validation and migration; percentages use the current 17px or 14.5px base. Saved width and text size apply before paint. |
| Navigation | Intersection-only tracking lost the current section in long passages; scrolling the active link could move the document. | Cached heading offsets, a frame-scheduled binary search, persistent `aria-current`, and scrolling limited to the sidebar. Offsets refresh when content resizes. Initial location restoration waits for diagram sizing and does not override the reader's own navigation. |
| Keyboard | Hidden navigation remained focusable. Dialog viewers lacked contained focus and restoration. Escape in a closed appearance panel could steal focus. | Hidden panels become inert; viewers and the mobile drawer contain keyboard focus and restore it on closing; Escape acts on open UI. The mobile drawer has a close control. |
| Images | Image zoom required a mouse and intercepted linked images. Relative images broke when exports lived outside the Markdown folder. | Enter and Space open unlinked images; image links retain their original action. Non-embedded local images resolve against the source folder, including paths with spaces; embedded exports retain Pandoc's resource lookup. |
| Tables | Expanded table height assumed a fixed toolbar height; keyboard scrolling lacked a focus target. | The scroll area fills the space below wrapped toolbars, headers stay visible, and the scroll area is a labeled keyboard target. |
| Tasks | Pandoc's label-wrapped checkboxes did not match the styling hooks. Inline task replacement rewrote HTML, including potential code or links. | Normalize actual checkbox items; convert only leading task markers using DOM nodes, retaining inline markup and listeners. |
| Code | Fence languages on Pandoc's `pre` elements were missed, leading to automatic language guessing. Large highlight ranges could allocate excessive entries. | Use explicit fence languages, leave unlabelled code plain, and bound line ranges to the actual code length. Expansion exposes its state to assistive tools. |
| Loading | Every export loaded all three third-party libraries and all diagram controls. Fonts and diagrams held the loading overlay open. A script failure could leave the overlay indefinitely. | Detect code, math, and diagrams in the Pandoc document; include only the required libraries and diagram assets; defer external scripts; reveal the reader before font and diagram completion; add a five-second overlay escape path and a readable no-JavaScript state. |
| Theme switching | Rapid selections queued obsolete diagram renders. | Skip obsolete queued renders and remaining work for superseded themes; avoid rendering on an unchanged selection. |
| Rendering | Diagram content retained `will-change` indefinitely; full-screen overlays stacked blur; the footer animated continuously. | Remove permanent promotion and full-screen filters. The footer pulse runs once on hover. Reading progress responds to changes in content height. |
| Printing | Floating controls, collapsed code, dark colors, and active viewers were unsuitable for paper. | Print rules hide reader UI, expand code, wrap tables and code, reset expanded viewers, and use readable ink colors. Screen typography remains unchanged. |

## Performance evidence

Compared against the working-directory assets captured before this pass:

- Theme files total about 21 KB instead of 47 KB.
- A prose-only export contains zero external library script tags instead of three.
- That prose export is about 49 KiB smaller with the same embedded fonts. Excluding font-face data, its HTML decreased from about 184 KB to 133 KB.
- Documents without Mermaid omit the diagram controller and diagram palette payload.
- Explicit code languages avoid Highlight.js auto-detection, while rapid theme changes skip obsolete diagram work.

The embedded fonts account for most of the total export size and remain unchanged. These are payload and work-reduction measurements, not a claimed universal page-load speedup. Network, font availability, document length, and diagram complexity still affect elapsed time.

## Validation

`npm test` checks formatting and linting, the exact four-theme inventory, 268 contrast combinations, theme/diagram color agreement, saved-theme migration, restricted storage, bounded code ranges, and multilingual heading IDs. Glass checks composite each theme over both black and white to bound the possible underlying colors.

`go test ./...` includes document exports for prose, code, math, diagrams, and mixed content in CDN and offline asset modes. It checks that only the required libraries are included and retired stylesheets are absent, and verifies images exported outside their source folder with and without embedding. `go vet ./...` also passes.

Browser validation uses `test_files/reader-audit.md`. It covers all four themes; desktop and 320px, 390px, and 768px widths; unchanged default typography; code expansion; table and diagram dialogs; keyboard image zoom; focus restoration; theme migration; and no-JavaScript readability. Additional checks exercise touch controls, transparency/contrast preferences, rapid theme switching, CDN failure, and an embedded offline code export.

Regenerate the specimen for visual review:

```sh
go run ./cmd/pdy --no-fmt --export test_files/reader-audit.md /tmp/reader-audit.html
```

Existing exported HTML includes its own styles and scripts. Regenerate those files to use the updated reader.
