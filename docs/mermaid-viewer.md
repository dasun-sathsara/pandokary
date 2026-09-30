# Mermaid viewer investigation

The viewer remains supported. Browser reproductions identified faults in Pandokary's
styling, gesture coordinates, and view state. These faults can be fixed using the
existing Mermaid SVG API. The repair keeps the pinned 11.4.0 browser bundle and the
existing document export pipeline.

## Research and confirmed failures

Mermaid's [API documentation](https://mermaid.js.org/config/usage.html#api-usage)
supports rendering source into a complete SVG and binding the returned interaction
functions after insertion. Its [font guidance](https://mermaid.js.org/config/usage.html#labels-out-of-bounds)
warns that layout before web fonts load can put labels outside their bounds.

The [11.4.0 shape implementation](https://github.com/mermaid-js/mermaid/blob/mermaid%4011.4.0/packages/mermaid/src/rendering-util/rendering-elements/shapes/util.ts)
reads the global `htmlLabels` setting for node labels. Setting only
`flowchart.htmlLabels: false` did not reliably select SVG text in this integration.
The repair sets both defaults and waits for the diagram fonts before rendering.

| Reproduction | Original behavior | Repair |
| --- | --- | --- |
| Inspect nested flowchart labels | A 14px SVG acquired labels as small as 6.98px. The reader reapplied `0.87em` to successive descendants. | Preserve the generated SVG's typography and source-defined colors. |
| Zoom and drag an embedded diagram | Zoom buttons worked, but pointer handlers returned unless fullscreen was active. | Enable mouse dragging in the embedded viewer. Preserve page scrolling for embedded touch input. |
| Change theme after zooming and panning | Rendering replaced the current view with a fit-to-screen reset. | Preserve the visible diagram center and zoom relative to its fitted size. |
| Resize a rotated mobile viewer to desktop | JavaScript continued swapping axes after the CSS rotation stopped applying. | Check the same media query as the rotation CSS and convert screen coordinates to actual viewport coordinates. |
| Interact while the modal is scaled | Screen distances and untransformed layout distances used different units. | Undo modal scale and mobile rotation when mapping pointer and wheel coordinates. |
| Hold a pinch while the fullscreen animation changes scale | The diagram grew with the modal even when the fingers stayed still. | Measure both the pinch distance and its center in untransformed viewport coordinates. |
| Zoom in several times | The SVG viewport stayed at its original resolution while CSS magnified a composited layer. Text and edges became pixelated. | Resize the native SVG viewport at each zoom level and use CSS only for translation. |

Other confirmed code problems included cached screen rectangles that could become
stale, resets on every resize, and post-render sequence-note resizing without
updating the SVG bounds. The repair measures the current viewport, preserves user
state across size changes, and leaves Mermaid's sequence geometry intact.

The geometry follows SVG's [viewBox semantics](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox).
The wrapper sizes the SVG viewport to the viewBox dimensions multiplied by the
current zoom. The intact SVG handles its own
coordinate origin, including negative viewBox origins. Fit leaves 24px padding,
does not enlarge small diagrams automatically, and allows sufficiently small
scales for large diagrams. Pan limits use the rendered graphics bounds to retain
a visible part of the diagram, including SVGs with large empty margins.

The wrapper no longer uses CSS `scale()`, `translate3d()`, or
`will-change: transform` for diagram zooming. Chrome's
[compositing guidance](https://developer.chrome.com/blog/re-rastering-composite)
explains that `will-change: transform` can retain a fixed rasterization when
transform scale changes. Native SVG resizing lets the browser repaint text and
paths at the current resolution.

[Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
define capture, cancellation, and browser gesture ownership. The expanded viewer
owns touch drag and pinch with `touch-action: none`. The embedded viewer keeps
`touch-action: pan-y`. Pointer cancellation, capture loss, blur, modal closure,
and controller removal release gesture state.

[Wheel events](https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event)
can represent both scrolling and zooming, with deltas in pixels, lines, or pages.
Ordinary embedded wheel input scrolls the document. Expanded wheel input pans in
both axes. Control or Command plus wheel zooms around the pointer. Browser
trackpad pinch events that set Control use the same zoom path.

The [11.4.0 public API](https://github.com/mermaid-js/mermaid/blob/mermaid%4011.4.0/packages/mermaid/src/mermaid.ts)
already queues individual render calls. Pandokary also serializes configuration
changes with complete render batches. Stale results are discarded before SVG
insertion, and adding new diagrams includes any existing controllers whose
earlier render may have been superseded.

## Version and export decision

An engine upgrade is outside this repair. Mermaid's [release notes](https://github.com/mermaid-js/mermaid/releases)
describe a breaking 12.0 migration with changed defaults and layout behavior.
Changing versions would require testing the exact browser bundle and its resource
loading. A newer release alone does not repair the reader's gesture logic or CSS.

[Pandoc resource embedding](https://pandoc.org/MANUAL.html#option--embed-resources)
embeds linked resources, while resources loaded later by JavaScript need separate
verification. The current single-file Mermaid bundle passes the browser suite
after reloading an offline export with networking disabled.

Malformed diagrams retain the original source in an expandable error panel. Their
zoom controls are disabled, and valid diagrams and reader controls continue to
work. If the library fails to load, the original Mermaid code blocks remain.

## Controls and verification

Mouse users can drag either viewer. Touch users open the expanded viewer to drag
or pinch. The zoom and reset buttons work in both views. A focused diagram also
supports arrow keys, plus or minus to zoom, and `0` or Home to fit. Escape closes
the expanded viewer and restores its previous embedded view.

Run the browser regressions with Go, Pandoc, and `agent-browser` available:

```sh
npm run check:mermaid
npm run check:mermaid -- --offline
```

These checks use actual generated HTML, the pinned Mermaid library, and Chromium
layout. They cover flowchart, sequence, class, state, entity relationship, Gantt,
pie, mindmap, timeline, and Git diagrams, all six palettes, source-defined colors,
malformed source, trusted mouse dragging, synthetic multi-pointer pinch and
cancellation, wheel anchoring, keyboard input, mobile rotation, resize, fullscreen
restoration, rapid theme changes, and controller cleanup.
They also cover changing modal scale during a pinch and adding an HTML-label
diagram while an earlier render batch is still pending.

The fixture is `testdata/mermaid-audit.md`. The browser check is separate from
`npm test` because it requires a browser driver and the CDN bundle in ordinary
mode. Mobile checks use Chromium viewport emulation and synthetic touch pointer
events. They do not replace verification on physical iOS or Android hardware.

Upstream renderer defects remain possible for particular source inputs and
diagram types. For example, [Mermaid issue 6424](https://github.com/mermaid-js/mermaid/issues/6424)
reports long-token label overflow in 11.5.0. That issue is not evidence that every
11.4.0 diagram fails, or that a later release fixes this reader. Diagnose such
inputs separately from viewport clipping.
