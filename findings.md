# Pandokary Codebase Audit & Consistency Report

*Generated from parallel read-only subagent audits covering Go backend, Frontend JS/Lua, CSS & Design System, and Project Tooling.*

---

## Executive Summary

The codebase is well-structured and functional, but the audit revealed several subtle bugs, inconsistencies, and configuration errors across all four domains. No fixes have been applied — this document compiles all findings for your review and approval.

---

## 1. Go Backend & CLI Findings (`cmd/pdy`, `internal/pdy`)

### 🔴 Critical / Logic Bugs
1. **`--embed-resources` Flag Ignored in CDN Mode (`internal/pdy/pdy.go:338`)**:
   - **Issue**: `pandocArgs()` checks `if options.AssetMode == "offline" && options.EmbedResources`. Because default `--asset-mode` is `"cdn"`, `--embed-resources` is **never passed** to Pandoc when operating in default CDN mode. Consequently, local Markdown images (`![alt](image.png)`) fail to embed even though embedding is enabled by default.
   - **Suggestion**: Remove the `options.AssetMode == "offline"` check so `--embed-resources` applies whenever `--no-embed` is not specified.

2. **Non-Atomic Markdown Formatting (`internal/pdy/pdy.go:297`)**:
   - **Issue**: `formatMarkdown()` overwrites the source `.md` file directly via `os.WriteFile()`. If interrupted mid-write or if disk space runs out, the original file is corrupted/truncated.
   - **Suggestion**: Write to a temporary file in the same directory first, then perform an atomic `os.Rename()`.

### 🟡 Warnings & Usability
3. **Double Stderr Error Output (`internal/pdy/pdy.go:352` & `cmd/pdy/main.go:42`)**:
   - **Issue**: `runPandoc` pipes Pandoc stderr to `io.MultiWriter(os.Stderr, &stderr)`. On error, it returns `fmt.Errorf("pandoc exited with code %d: %s")`, which `main()` prints to `Stderr` **again**, resulting in duplicate error banners in the terminal.
   - **Suggestion**: Capture stderr into a buffer during execution and return the error message without duplicating live output.

4. **Verbose Output Pollutes `os.Stdout` (`internal/pdy/pdy.go:69` & `cmd/pdy/main.go:46`)**:
   - **Issue**: When `--verbose` and `--export` are combined, debug logs are written to `os.Stdout`, which breaks UNIX piping scripts expecting only the output path on `Stdout`.
   - **Suggestion**: Redirect verbose debug logging to `os.Stderr`.

5. **Headless Linux Browser Failure Deletes Preview HTML (`internal/pdy/pdy.go:76-78`)**:
   - **Issue**: On headless Linux (SSH sessions, WSL, CI/CD), `xdg-open` fails. `Run()` catches the error and immediately runs `os.RemoveAll(previewDir)`, deleting the generated HTML file before the user can view or copy it.
   - **Suggestion**: Keep the generated HTML output path and log a warning on browser open failure instead of deleting the directory.

6. **Windows Browser Launcher Fragility (`internal/pdy/pdy.go:370`)**:
   - **Issue**: Uses `rundll32 url.dll,FileProtocolHandler` which fails or truncates when the temp path contains spaces.
   - **Suggestion**: Use `exec.Command("cmd", "/c", "start", "", path)` on Windows.

---

## 2. Frontend Assets, JS & Lua Findings

### 🟡 Warnings & Robustness
1. **Highlight.js Version Mismatch (`assets/mathjax-config.js` vs `assets/template.html`)**:
   - **Issue**: `template.html` loads MathJax STIX2 font script `4.0.0`, while `mathjax-config.js` references general config structures.
   - **Suggestion**: Synchronize MathJax font script CDN version tags.

2. **Lua String Escaping in Inline Metadata (`assets/inline-assets.lua:60`)**:
   - **Issue**: `build_theme_js()` builds JavaScript JSON strings using `string.format("%q:%s", id, json_str)`. If JSON content contains unescaped single quotes or script end tags (`</script>`), inline script injection breaks.
   - **Suggestion**: Use safe string JSON encoding/escaping inside Lua.

3. **Unhandled Hash Scroll Exception in `app.js`**:
   - **Issue**: `document.querySelector(location.hash)` throws an unhandled `DOMException` if `location.hash` contains special characters or numeric IDs (e.g. `#123`).
   - **Suggestion**: Wrap hash selector lookups in `try...catch` or use `document.getElementById(hash.slice(1))`.

4. **Accessibility (a11y) Missing on Loading Overlay (`assets/template.html:50`)**:
   - **Issue**: `#loading-overlay` lacks ARIA live region attributes (`role="status"`, `aria-live="polite"`).
   - **Suggestion**: Add `role="status"` and `aria-live="polite"` to the loading overlay.

---

## 3. CSS & Design System Findings

### 🟡 Inconsistencies & Legibility
1. **Accent Color Mismatch for Studio Dark Theme**:
   - **Issue**: `assets/themes/manifest.json` lists accent `#007acc` for `studio-dark`, but `assets/themes/css/studio-dark.css` defines `--color-accent: #0078d4`.
   - **Suggestion**: Align accent in `manifest.json` to `#0078d4`.

2. **Theme Preview Dot Color Mismatch for Parchment Theme**:
   - **Issue**: `.parchment-dot::after` in `assets/components/settings.css` uses `#cb4b16`, but `assets/themes/css/parchment.css` defines `--color-accent: #b65d3c`.
   - **Suggestion**: Update `.parchment-dot::after` background to `#b65d3c`.

3. **Low Contrast Code Comment Tokens in Light Themes**:
   - **Issue**: `--code-comment: #94a3b8` in `lumina.css` yields a 2.6:1 contrast ratio on `#f8fafc` background (fails WCAG AA threshold of 4.5:1).
   - **Suggestion**: Darken `--code-comment` to `#64748b` in `lumina.css` and `#786b59` in `parchment.css`.

4. **Unscoped Table Styles in Component CSS (`assets/components/tables.css`)**:
   - **Issue**: `table`, `th`, `td` element selectors are unscoped, which could bleed into embedded HTML widgets or user-defined custom tables.
   - **Suggestion**: Scope core table rules to `main table` or `.table-wrapper table`.

---

## 4. Project Tooling & Configuration Findings

### 🟡 Configuration & Quality
1. **`.golangci.yml` Invalid Schema Keys**:
   - **Issue**: Top-level key `version: "2"` is invalid for current `golangci-lint` versions (causing linter configuration warnings).
   - **Suggestion**: Update `.golangci.yml` schema structure.

2. **`package.json` Missing Metadata & Standard Scripts**:
   - **Issue**: Lacks `repository`, `author`, `license` fields and standard `test` / `build` scripts.
   - **Suggestion**: Add metadata fields and alias `scripts`.

3. **`Makefile` Completeness**:
   - **Issue**: Lacks `test`, `lint`, `install` targets.
   - **Suggestion**: Add standard targets: `make test`, `make lint`, `make install`.

---

## Next Steps

Review these findings. Once you approve, fixes can be systematically applied and verified.
