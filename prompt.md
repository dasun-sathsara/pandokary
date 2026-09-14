# Mobile reader fixes — handoff brief

## Goal
Fix mobile rendering of pandokary HTML exports: code blocks, Appearance popover, paragraph rhythm. Owner tests with `pdy README.md` (preview server) in Chrome Responsive 434×850 and on a Pixel 7 phone (412px). Prior fixes passed all automated checks and looked right in headless Chromium but did NOT visibly fix the owner's screen — treat headless screenshots as unreliable for touch rules (trap #1).

## Repro (exact)
```
cd /Users/dasun/Home/code/pandokary && make build && ./scripts/install.sh && pdy README.md
```
Open the printed preview URL. NOTE: preview HTML inlines CSS/JS at generation time — every source change needs rebuild + reinstall + a fresh preview run (new tmpdir per run; old tabs are stale snapshots). Owner's binary is `~/.local/bin/pdy`, not `./bin/pdy`.

## Issues (all still open)
1. Code blocks: long lines (e.g. the `git clone https://github.com/dasun-sathsara/pandokary.git` lines under Unix/Windows Installation) clip at the right edge with no visible cue. Must stay horizontally scrollable — soft-wrap was tried and REJECTED by owner.
2. Appearance popover still too big on the phone.
3. Paragraph/list rhythm on narrow widths still looks off.

## State of tree (uncommitted; `git status` to see all)
- `assets/components/responsive.css`: `--page-gutter` fluid token; ≤1199px left-aligned hyphenated prose, `break-word` replacing `anywhere`; new ≤768px section (full-bleed `pre` band via negative margins + `max-width:none`, `pre.is-scrollable/at-left/at-right` background-layer edge fades, left footer); coarse-pointer overrides capping popover controls at 34px.
- `assets/app.js` CodeBlockModule: `addScrollAffordance(pre)` toggles the fade classes, phone-gated via matchMedia ≤768px, plus ResizeObserver and tabindex/role.
- Light themes get `--code-fade: rgba(0,0,0,0.16)` 24px fades; dark themes keep their token veil.

## Traps (learned the hard way)
1. Headless desktop Chromium NEVER matches `(pointer:coarse)`/`(hover:none)` — touch-sizing bugs (e.g. the 44px blanket in the responsive.css coarse block) are invisible there. No touch emulation available (`--args --touch-events` doesn't take). Verify coarse rules by cascade reasoning (specificity/order) plus a real device, not screenshots.
2. `npm test` (biome, theme contrast, reader regressions) + `go test ./...` pass — they cover none of this.
3. Full-bleed `pre` needs `max-width:none`: base `max-width:100%` clamps the negative-margin band asymmetrically.
4. Don't touch: desktop rendering (justified prose, inset code cards) must stay identical; copy button stays hidden on mobile (owner's earlier call).

## Acceptance
At 434px and 412px on a real touch device: every clipped code line shows an unmistakable edge fade and swipes; the code band reads as a band; the popover fits comfortably (~360px tall, right-docked 300px wide); prose has even color without shredded identifiers. Desktop unchanged. `npm test` + `go test ./...` green.
