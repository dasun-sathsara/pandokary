# pandokary

`pandokary` wraps Pandoc with project-aware defaults and a reproducible set of HTML assets so Markdown notes render consistently across environments.

- **CLI entry point**: `cmd/pdy/main.go` parses flags and calls the rendering pipeline in `internal/pdy/`.
- **Rendering pipeline**: `internal/pdy/` separates asset lookup, source formatting, Pandoc arguments, and staged output.
- **Assets**: `assets/` contains the HTML template, CSS, browser modules, and Lua filter embedded into the binary.
- **Samples**: `testdata/` stores example Markdown inputs for manual and automated checks.

## Requirements

- Go 1.21 or newer
- Pandoc available on `PATH`
- [dprint](https://dprint.dev/) available on `PATH` (used to auto-format Markdown before conversion; pass `--no-fmt` to skip)

## Unix Installation

```sh
git clone https://github.com/dasun-sathsara/pandokary.git
cd pandokary
./scripts/install.sh
```

The script checks for `Git`, `Go >= 1.21`, `Pandoc`, and `dprint`, then builds `pdy` into `~/.local/bin` (override with `./scripts/install.sh <repo-dir> <install-dir>`).
Relative repository and install paths resolve from the directory where you invoke the script.

## Windows Installation

Run these commands in PowerShell:

```powershell
git clone https://github.com/dasun-sathsara/pandokary.git
cd pandokary
.\scripts\install_windows.ps1
```

The installer will:

- install missing dependencies (`Git`, `Go >= 1.21`, `Pandoc`, `dprint`) via `winget` (or `choco` / `scoop`)
- build `pdy.exe`
- install `pdy.exe` to `%LOCALAPPDATA%\Programs\pdy`
- refresh the repository `assets/` directory at `%LOCALAPPDATA%\Programs\pdy\assets`
- add that directory to your user `PATH`

Optional flags:

```powershell
.\scripts\install_windows.ps1 -ForcePull
.\scripts\install_windows.ps1 -SkipDependencyInstall
.\scripts\install_windows.ps1 -RepoDir "D:\dev\pandokary" -InstallDir "D:\tools\pdy"
```

## Build & Run

```sh
go run ./cmd/pdy --help
make build
```

The `bin/` directory is local build output and is intentionally ignored by Git.

The compiled binary looks for assets in this order:

- `PDY_ASSETS_DIR`, when set to a valid asset directory
- an `assets/` directory next to the executable
- `./assets/` found by walking up from the current working directory
- embedded assets shipped inside the binary

You can override asset lookup entirely by setting `PDY_ASSETS_DIR` to a complete copy of the `assets/` directory, including its subdirectories and `reader-scripts.json`.

Exports are staged beside their destination and saved only after Pandoc succeeds.
A failed conversion leaves an existing export intact and removes temporary output.
Existing export permissions and destination symlinks are preserved. An output path
that refers to the source file, including through a symlink or hardlink, is rejected
before source formatting runs.

### Asset modes

`pandokary` now supports two asset strategies via `--asset-mode`:

- `cdn` (default) leaves third-party bundles (MathJax, highlight.js) on their CDNs and does **not** request `--embed-resources`, keeping exports slim. Core CSS/JS remains inline so previews work from the temp directory, but your local images/attachments stay as file references. Pass `--embed` to explicitly produce a self-contained CDN-mode export.
- `offline` inlines CDN bundles and other embeddable resources for offline viewing; expect a much larger HTML. Use `--no-embed` to leave other embeddable resources external instead.

Relative image and attachment links resolve from the Markdown source directory,
including when a preview or export lives elsewhere. Embedding inlines images;
attachment hyperlinks still point to their source files.

#### Bundled fonts

The variable fonts are **Studio Feixen Sans**, **Geist Mono**, and **Noto Sans Sinhala**. Desktop Sans uses 400 regular, 550 strong/bold, and 600 headings; below 1200px those weights become 430, 580, and 630. Desktop Mono uses 420 regular and 520 strong/bold/headings; below 1200px it uses 450 and 550. Sans and Mono use their native italic designs, with synthetic styles disabled; Studio Feixen Sans uses the full `ital` axis value of 1.0 (the font axis runs from 0 to 1). Code stays at 87% of the surrounding Sans size and `-0.01em` tracking. Noto Sans Sinhala supplies Sinhala glyphs in prose and mixed-script code at 400/540/580 on desktop and 430/570/610 below 1200px, with the established 88% optical `size-adjust`.

Text rendering and optical sizing use the browser defaults; no platform-specific smoothing or legibility overrides are applied.

The Appearance panel includes a persistent **Weight Adjustment** control for the Latin sans and monospace roles. Enter a value from -100 to +100, or use the stepper buttons, to shift the typographic roles together. For example, -30 changes the desktop 400 body weight to 370 while preserving the relative differences between body, emphasis, headings, and monospace text.

The four original variable-font binaries are packaged directly (one WOFF2 and three TTFs). Each binary is encoded once in the exported HTML; a short script creates shared in-memory font URLs before the document body loads. This keeps the export self-contained without repeating the Sinhala binary for every weight mapping. No per-weight font cuts are generated. The Geist Mono and Noto Sans Sinhala OFL licenses are included beside their source binaries; the Studio Feixen Sans file comes from the user's local font collection.

### Markdown formatting

By default, `pdy` runs `dprint fmt` on the input Markdown file before passing it to Pandoc. This normalises list indentation, whitespace, and other formatting inconsistencies. Use `--no-fmt` to skip this step.
Formatting a source symlink updates its target and preserves the symlink.

## Testing

```sh
go test ./...
npm test
```

`npm test` checks browser assets and all six theme palettes, including text contrast,
selected controls, translucent surfaces, syntax highlighting, and agreement with the Mermaid colors.
It also checks saved-theme migration, restricted storage, heading IDs, and bounded code-line ranges.
Safety regressions cover literal missing-image labels and reader startup when an optional library fails.
Go regressions cover failed exports, source/destination collisions, symlink handling, and local attachment links.
Theme colors live in `assets/themes/css/`; their accents and diagram colors are mirrored
in `assets/themes/manifest.json` and `assets/themes/mermaid/`. The appearance swatches use
the CSS theme colors directly.

The six themes are **Lumina** (pale mineral, deep teal accent), **Porcelain** (white and
neutral light, blue accent), **Parchment** (warm ivory, oxblood accent), **Obsidian**
(warm charcoal, muted apricot accent), **Midnight Fjord** (neutral slate, mist-blue accent),
and **Evergreen** (soft charcoal, muted sage accent and warm gray text).
See [the palette notes](docs/theme-palettes.md) for the color research and contrast measurements.
Old saved choices migrate to a supported theme automatically.

Floating controls and the appearance panel use solid, contrast-optimized surfaces. Reduced-transparency
and increased-contrast preferences use reinforced borders. Typography uses Sans 400/550/600,
Mono 420/520, and Noto Sans Sinhala 400/540/580 on desktop and mobile.
Touch controls request short haptic pulses through the Vibration API when the browser and device support it; unsupported browsers, including Safari on iOS, keep the full visual and assistive feedback without vibration. Reading time is calculated from Pandoc prose at 238 words per minute, excluding code, math, diagram source, image alt text, and generated reader controls.
Code, math, and diagram libraries load only when the Markdown needs them. Plain documents make
no requests for those libraries; diagram controls and diagram palettes are omitted from those exports.

Use `testdata/reader-audit.md` to check all reader components together.

Regenerate existing HTML exports to pick up style changes, since exports include their CSS.

Consider adding samples under `testdata/` when covering new scenarios.

## Development Notes

- Format Go code with `gofmt` (or `goimports`) before committing.
- Group imports by standard library, third-party, then local packages.
- Run `go vet ./...` and `golangci-lint run` when the linter is available. The configuration uses the golangci-lint v2 schema.
- Browser features live in `assets/modules/`; `assets/app.js` coordinates startup. Keep their dependency order in `assets/reader-scripts.json`. The Lua filter and reader checks use the same manifest to assemble the source.
- Shared browser utilities live in `modules/runtime.js`, and each feature exposes its interface through `PDY`. Optional feature failures are reported without interrupting other reader controls.

## Contributing

Keep commits focused and written in the present tense (e.g. `Add pandoc flag validation`). Describe user-facing changes and the tests you ran when opening a pull request.
