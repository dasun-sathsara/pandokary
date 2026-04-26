# pandokary

`pandokary` wraps Pandoc with project-aware defaults and a reproducible set of HTML assets so Markdown notes render consistently across environments.

- **CLI entry point**: `cmd/pdy/main.go` parses flags, resolves assets, and shells out to Pandoc.
- **Assets**: `assets/` contains the HTML template, CSS, and Lua filter embedded into the binary.
- **Samples**: `test_files/` stores example Markdown inputs for manual and automated checks.

## Requirements

- Go 1.21 or newer
- Pandoc available on `PATH`

## Windows Installation

Run these commands in PowerShell:

```powershell
git clone https://gitlab.com/dasun-sathsara/pandokary.git
cd pandokary
.\install-windows.ps1
```

The installer will:

- install missing dependencies (`Git`, `Go >= 1.21`, `Pandoc`) via `winget` (or `choco` / `scoop`)
- build `pdy.exe`
- install to `%LOCALAPPDATA%\Programs\pdy`
- add that directory to your user `PATH`

Optional flags:

```powershell
.\install-windows.ps1 -ForcePull
.\install-windows.ps1 -SkipDependencyInstall
.\install-windows.ps1 -RepoDir "D:\dev\pandokary" -InstallDir "D:\tools\pdy"
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

- `cdn` (default) leaves third-party bundles (MathJax, highlight.js, Google Fonts) on their CDNs and does **not** request `--embed-resources`, keeping exports slim. Core CSS/JS remains inline so previews work from the temp directory, but your local images/attachments stay as file references.
- `offline` inlines everything (including CDN bundles) for fully offline viewing; expect a much larger HTML because fonts and math assets are embedded. Pair with `--no-embed` if you still want Pandoc to leave your local images/attachments as external files.

## Testing

```sh
go test ./...
```

Consider adding samples under `test_files/` when covering new scenarios.

## Development Notes

- Format Go code with `gofmt` (or `goimports`) before committing.
- Group imports by standard library, third-party, then local packages.
- Run `golangci-lint run` if available, otherwise `go vet ./...`.

## Contributing

Keep commits focused and written in the present tense (e.g. `Add pandoc flag validation`). Describe user-facing changes and the tests you ran when opening a pull request.
