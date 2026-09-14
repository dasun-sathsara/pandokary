# pandokary

`pandokary` wraps Pandoc with project-aware defaults and a reproducible set of HTML assets so Markdown notes render consistently across environments.

- **CLI entry point**: `cmd/pdy/main.go` parses flags, resolves assets, and shells out to Pandoc.
- **Assets**: `assets/` contains the HTML template, CSS, and Lua filter embedded into the binary.
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

You can override asset lookup entirely by setting `PDY_ASSETS_DIR` to a directory that contains the required asset files.

### Asset modes

`pandokary` now supports two asset strategies via `--asset-mode`:

- `cdn` (default) leaves third-party bundles (MathJax, highlight.js) on their CDNs and does **not** request `--embed-resources`, keeping exports slim. Core CSS/JS remains inline so previews work from the temp directory, but your local images/attachments stay as file references. Pass `--embed` to explicitly produce a self-contained CDN-mode export.
- `offline` inlines everything (including CDN bundles) for fully offline viewing; expect a much larger HTML because fonts and math assets are embedded. Use `--no-embed` to leave resources external instead.

### Markdown formatting

By default, `pdy` runs `dprint fmt` on the input Markdown file before passing it to Pandoc. This normalises list indentation, whitespace, and other formatting inconsistencies. Use `--no-fmt` to skip this step.

## Testing

```sh
go test ./...
npm test
```

`npm test` checks browser assets and all five theme palettes, including text contrast,
selected controls, translucent surfaces, syntax highlighting, and agreement with the Mermaid colors.
It also checks saved-theme migration, restricted storage, heading IDs, and bounded code-line ranges.
Theme colors live in `assets/themes/css/`; their accents and diagram colors are mirrored
in `assets/themes/manifest.json` and `assets/themes/mermaid/`. The appearance swatches use
the CSS theme colors directly.

The five themes are **Lumina** (pale light, violet accent), **Porcelain** (white and
neutral light, blue accent), **Parchment** (soft paper, olive accent), **Obsidian**
(warm charcoal, apricot accent), and **Midnight Fjord** (deep plum, rose accent).
Old saved choices migrate to a supported theme automatically.

Floating controls and the appearance panel use solid, contrast-optimized surfaces. Reduced-transparency
and increased-contrast preferences use reinforced borders. Typography and document layout stay the same.
Code, math, and diagram libraries load only when the Markdown needs them. Plain documents make
no requests for those libraries; diagram controls and diagram palettes are omitted from those exports.

Use `testdata/reader-audit.md` to check all reader components together.

Regenerate existing HTML exports to pick up style changes, since exports include their CSS.

Consider adding samples under `testdata/` when covering new scenarios.

## Development Notes

- Format Go code with `gofmt` (or `goimports`) before committing.
- Group imports by standard library, third-party, then local packages.
- Run `golangci-lint run` if available, otherwise `go vet ./...`.

## Contributing

Keep commits focused and written in the present tense (e.g. `Add pandoc flag validation`). Describe user-facing changes and the tests you ran when opening a pull request.
