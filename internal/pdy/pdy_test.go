package pdy

import (
	"bytes"
	"encoding/base64"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"testing"
)

func TestImagesResolveOutsideSourceFolder(t *testing.T) {
	source := filepath.Join(t.TempDir(), "notes with spaces")
	if err := os.MkdirAll(source, 0o755); err != nil {
		t.Fatal(err)
	}
	svg := `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="green"/></svg>`
	if err := os.WriteFile(filepath.Join(source, "figure one.svg"), []byte(svg), 0o644); err != nil {
		t.Fatal(err)
	}
	input := filepath.Join(source, "notes.md")
	if err := os.WriteFile(input, []byte("# Notes\n\n![Figure](figure%20one.svg)\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	for _, embed := range []bool{false, true} {
		result, err := Run(Options{InputPath: input, Export: true, ExportName: filepath.Join(t.TempDir(), "export.html"), AssetMode: "cdn", EmbedResources: embed})
		if err != nil {
			t.Fatal(err)
		}
		html, err := os.ReadFile(result.OutputPath)
		if err != nil {
			t.Fatal(err)
		}
		match := regexp.MustCompile(`<img[^>]*src="([^"]+)"`).FindStringSubmatch(string(html))
		if len(match) != 2 {
			t.Fatal("export is missing its image")
		}
		if embed {
			if !strings.HasPrefix(match[1], "data:image/svg+xml") {
				t.Errorf("embedded image has unexpected source: %s", match[1])
			}
			continue
		}
		u, err := url.Parse(match[1])
		if err != nil || u.Scheme != "file" {
			t.Fatalf("image must resolve to a local file: %s", match[1])
		}
		path := u.Path
		if runtime.GOOS == "windows" {
			path = strings.TrimPrefix(path, "/")
		}
		data, err := os.ReadFile(filepath.FromSlash(path))
		if err != nil {
			t.Fatal(err)
		}
		if string(data) != svg {
			t.Error("resolved image differs from source")
		}
	}
}

func TestReaderLoadsOnlyRequiredLibraries(t *testing.T) {
	cases := []struct {
		name, markdown      string
		code, math, diagram bool
	}{
		{"prose", "# Notes\n\nA paragraph with `inline code`.\n", false, false, false},
		{"code", "```javascript\nconst answer = 42;\n```\n", true, false, false},
		{"math", "Inline $x^2$ and a display:\n\n$$y = x + 1$$\n", false, true, false},
		{"diagram", "```mermaid\nflowchart LR\nA --> B\n```\n", false, false, true},
		{"mixed", "```js\nconst x = 1;\n```\n\n$x$\n\n```mermaid\nflowchart LR\nA --> B\n```\n", true, true, true},
	}
	for _, mode := range []string{"cdn", "offline"} {
		for _, tc := range cases {
			t.Run(mode+"/"+tc.name, func(t *testing.T) {
				dir := t.TempDir()
				input := filepath.Join(dir, "notes.md")
				if err := os.WriteFile(input, []byte(tc.markdown), 0o644); err != nil {
					t.Fatal(err)
				}
				result, err := Run(Options{InputPath: input, Export: true, ExportName: filepath.Join(dir, "notes.html"), AssetMode: mode})
				if err != nil {
					t.Fatal(err)
				}
				data, err := os.ReadFile(result.OutputPath)
				if err != nil {
					t.Fatal(err)
				}
				html := string(data)
				scripts := strings.Join(regexp.MustCompile(`<script[^>]+src="[^"]+"[^>]*>`).FindAllString(html, -1), "\n")
				for name, wanted := range map[string]bool{"highlight.min.js": tc.code, "MathJax-script": tc.math, "mermaid.min.js": tc.diagram} {
					if strings.Contains(scripts, name) != wanted {
						t.Errorf("library %s present=%v, want %v", name, !wanted, wanted)
					}
				}
				if strings.Contains(html, "const MIN_SCALE") != tc.diagram {
					t.Error("diagram controller must be bundled only for diagrams")
				}
				for _, theme := range []string{"lumina", "porcelain", "parchment", "obsidian", "midnight-fjord", "evergreen"} {
					if !strings.Contains(html, `[data-theme="`+theme+`"]`) {
						t.Errorf("missing theme %s", theme)
					}
					if strings.Contains(html, `"`+theme+`":{`) != tc.diagram {
						t.Errorf("diagram palette %s must be bundled only for diagrams", theme)
					}
				}
				for _, removed := range []string{"primer", "verdant-paper", "lilac-frost", "studio-dark", "ayu-mirage", "boreal"} {
					if strings.Contains(html, `[data-theme="`+removed+`"]`) {
						t.Errorf("retired stylesheet %s was bundled", removed)
					}
				}
			})
		}
	}
}

func TestReadingTimeCountsPandocProse(t *testing.T) {
	dir := t.TempDir()
	input := filepath.Join(dir, "reading-time.md")
	prose := strings.TrimSpace(strings.Repeat("word ", 239))
	code := strings.TrimSpace(strings.Repeat("const ignoredToken = true; ", 100))
	markdown := prose + "\n\n```javascript\n" + code + "\n```\n"
	if err := os.WriteFile(input, []byte(markdown), 0o644); err != nil {
		t.Fatal(err)
	}

	result, err := Run(Options{
		InputPath: input, Export: true, ExportName: filepath.Join(dir, "reading-time.html"),
		AssetMode: "cdn", FormatMarkdown: false,
	})
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(result.OutputPath)
	if err != nil {
		t.Fatal(err)
	}
	html := string(data)
	if !strings.Contains(html, `data-reading-minutes="2"`) {
		t.Error("reading time must use prose words and exclude generated/code-only tokens")
	}
	if strings.Contains(html, `main.textContent.trim().split`) {
		t.Error("reading time must not be recalculated from enhanced DOM text")
	}
	if strings.Contains(html, `label.className = "reading-time"`) {
		t.Error("reading-time UI must be present in the initial HTML rather than appended after load")
	}
	if !strings.Contains(html, `class="ph ph-timer reading-time-icon"`) {
		t.Error("reading time must use the Phosphor Timer icon")
	}
}

func TestReadingTimeIgnoresFrontMatter(t *testing.T) {
	cases := []struct {
		name, markdown string
		minutes        int
	}{
		{
			name: "boundary",
			markdown: "---\ntitle: Extra\nauthor: Someone\nreading-minutes: 99\n---\n\n" +
				strings.TrimSpace(strings.Repeat("word ", 238)) + "\n",
			minutes: 1,
		},
		{
			name:     "title only",
			markdown: "---\ntitle: Extra\nauthor: Someone\nreading-minutes: 99\n---\n",
		},
		{
			name: "code only",
			markdown: "---\ntitle: Extra\nauthor: Someone\nreading-minutes: 99\n---\n\n" +
				"```javascript\nconst ignoredToken = true;\n```\n",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			input := filepath.Join(dir, "document.md")
			if err := os.WriteFile(input, []byte(tc.markdown), 0o644); err != nil {
				t.Fatal(err)
			}
			result, err := Run(Options{
				InputPath: input, Export: true, ExportName: filepath.Join(dir, "document.html"),
				AssetMode: "cdn", FormatMarkdown: false,
			})
			if err != nil {
				t.Fatal(err)
			}
			data, err := os.ReadFile(result.OutputPath)
			if err != nil {
				t.Fatal(err)
			}
			hasReadingTime := regexp.MustCompile(`<main[^>]*data-reading-minutes`).Match(data)
			if hasReadingTime != (tc.minutes > 0) {
				t.Fatalf("reading-time presence = %v, want %v", hasReadingTime, tc.minutes > 0)
			}
			if tc.minutes > 0 && !strings.Contains(string(data), `data-reading-minutes="`+strconv.Itoa(tc.minutes)+`"`) {
				t.Errorf("expected data-reading-minutes=%d", tc.minutes)
			}
		})
	}
}

func TestReadingTimeCountsLexicalProseOnly(t *testing.T) {
	formatted := strings.TrimSpace(strings.Repeat("**word**, ", 100))
	plain := strings.TrimSpace(strings.Repeat("word ", 138))
	prose := formatted + " " + plain
	altText := strings.TrimSpace(strings.Repeat("word ", 100))
	cases := []struct {
		name, markdown string
		minutes        int
	}{
		{name: "formatted punctuation", markdown: prose + "\n", minutes: 1},
		{name: "image alt text", markdown: prose + "\n\n![alt " + altText + "](image.svg)\n", minutes: 1},
		{name: "symbols after prose", markdown: prose + " ❤️ ✈️ € ™ ।\n", minutes: 1},
		{name: "symbols only", markdown: "❤️ ✈️ € ™ । \u1680\uFE0F\n"},
		{name: "punctuation only", markdown: "। — ©\n"},
		{name: "unicode whitespace only", markdown: "\u1680\n"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			input := filepath.Join(dir, "document.md")
			if err := os.WriteFile(input, []byte(tc.markdown), 0o644); err != nil {
				t.Fatal(err)
			}
			result, err := Run(Options{
				InputPath: input, Export: true, ExportName: filepath.Join(dir, "document.html"),
				AssetMode: "cdn", FormatMarkdown: false,
			})
			if err != nil {
				t.Fatal(err)
			}
			data, err := os.ReadFile(result.OutputPath)
			if err != nil {
				t.Fatal(err)
			}
			hasReadingTime := regexp.MustCompile(`<main[^>]*data-reading-minutes`).Match(data)
			if hasReadingTime != (tc.minutes > 0) {
				t.Fatalf("reading-time presence = %v, want %v", hasReadingTime, tc.minutes > 0)
			}
			if tc.minutes > 0 && !strings.Contains(string(data), `data-reading-minutes="`+strconv.Itoa(tc.minutes)+`"`) {
				t.Errorf("expected data-reading-minutes=%d", tc.minutes)
			}
		})
	}
}

func TestEmptyDocumentOmitsReadingTime(t *testing.T) {
	dir := t.TempDir()
	input := filepath.Join(dir, "empty.md")
	if err := os.WriteFile(input, []byte("\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	result, err := Run(Options{
		InputPath: input, Export: true, ExportName: filepath.Join(dir, "empty.html"),
		AssetMode: "cdn", FormatMarkdown: false,
	})
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(result.OutputPath)
	if err != nil {
		t.Fatal(err)
	}
	if regexp.MustCompile(`<main[^>]*data-reading-minutes`).Match(data) {
		t.Error("empty documents must not show a zero-minute reading estimate")
	}
}

func TestFontAssetsBundledInCDNAndOfflineModes(t *testing.T) {
	tempDir := t.TempDir()
	// Create a sample markdown file
	mdFile := filepath.Join(tempDir, "sample.md")
	if err := os.WriteFile(mdFile, []byte("# Test Document\n\nHello world"), 0o644); err != nil {
		t.Fatalf("failed to write test markdown: %v", err)
	}

	modes := []string{"cdn", "offline"}
	for _, mode := range modes {
		t.Run("mode_"+mode, func(t *testing.T) {
			outPath := filepath.Join(tempDir, "output_"+mode+".html")
			opts := Options{
				InputPath:      mdFile,
				Export:         true,
				ExportName:     outPath,
				AssetMode:      mode,
				FormatMarkdown: false,
			}
			res, err := Run(opts)
			if err != nil {
				t.Fatalf("Run failed for mode %s: %v", mode, err)
			}

			htmlBytes, err := os.ReadFile(res.OutputPath)
			if err != nil {
				t.Fatalf("failed to read output HTML for mode %s: %v", mode, err)
			}
			html := string(htmlBytes)

			for _, expected := range []string{
				`font-family: "Studio Feixen Sans";`,
				`font-family: "Geist Mono";`,
				`font-family: "Noto Sans Sinhala";`,
				`local("StudioFeixenSansVF")`,
				"font-weight: 100 900;",
				"--font-weight-adjustment: 0;",
				"--body-font-weight-desktop: 400;",
				"--body-font-weight-mobile: 430;",
				"--body-font-weight: var(--body-font-weight-desktop);",
				"--strong-font-weight-desktop: 550;",
				"--strong-font-weight: var(--strong-font-weight-desktop);",
				"--heading-font-weight-desktop: 600;",
				"--heading-font-weight-mobile: 630;",
				"--mono-font-weight-desktop: 420;",
				"--mono-font-weight-mobile: 450;",
				"--mono-emphasis-font-weight-desktop: 520;",
				"--mono-emphasis-font-weight-mobile: 550;",
				`font-variation-settings: "ital" 1;`,
				"size-adjust: 88%;",
				"--letter-spacing-body: -0.005em;",
				"--letter-spacing-heading: -0.015em;",
				"--letter-spacing-mono: -0.01em;",
			} {
				if !strings.Contains(html, expected) {
					t.Errorf("Mode %s: output HTML missing %q", mode, expected)
				}
			}
			for _, obsolete := range []string{"TheFont-", "Android Trial", "Mobile Trial", "Feixen Mono Box", `url("fonts/`} {
				if strings.Contains(html, obsolete) {
					t.Errorf("Mode %s: output HTML still contains obsolete font path %q", mode, obsolete)
				}
			}
			// Role declarations retain their CSS weight mappings, while each source
			// font is encoded only once in the HTML's font loader.
			fontFiles := []string{
				"StudioFeixenSans-Variable.woff2",
				"GeistMono-Variable.ttf",
				"GeistMono-Variable-Italic.ttf",
				"NotoSansSinhala-Variable.ttf",
			}
			if !strings.Contains(html, `id="pdy-inline-css"`) || !strings.Contains(html, "URL.createObjectURL") {
				t.Errorf("Mode %s: missing inline stylesheet or font loader", mode)
			}
			for _, name := range fontFiles {
				want, err := os.ReadFile(filepath.Join("..", "..", "assets", "fonts", name))
				if err != nil {
					t.Fatalf("Mode %s: read packaged font %s: %v", mode, name, err)
				}
				encoded := base64.StdEncoding.EncodeToString(want)
				if copies := strings.Count(html, encoded); copies != 1 {
					t.Errorf("Mode %s: found %d copies of %s, want one", mode, copies, name)
				}
				if !strings.Contains(html, `url("pdy-font:`+name+`")`) {
					t.Errorf("Mode %s: missing CSS reference to %s", mode, name)
				}
			}

		})
	}
}

func TestOfflineExportDoesNotDuplicateFontPayloads(t *testing.T) {
	dir := t.TempDir()
	input := filepath.Join(dir, "tiny.md")
	if err := os.WriteFile(input, []byte("x\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	result, err := Run(Options{
		InputPath: input, Export: true, ExportName: filepath.Join(dir, "tiny.html"),
		AssetMode: "offline", EmbedResources: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	html, err := os.ReadFile(result.OutputPath)
	if err != nil {
		t.Fatal(err)
	}
	font, err := os.ReadFile(filepath.Join("..", "..", "assets", "fonts", "NotoSansSinhala-Variable.ttf"))
	if err != nil {
		t.Fatal(err)
	}
	encoded := []byte(base64.StdEncoding.EncodeToString(font))
	if copies := bytes.Count(html, encoded); copies != 1 {
		t.Errorf("Sinhala font payload appears %d times; want one copy", copies)
	}
	if len(html) > 3_000_000 {
		t.Errorf("tiny offline export is %d bytes; want at most 3 MB", len(html))
	}
}

func TestMermaidSubgraphConfigInjected(t *testing.T) {
	tempDir := t.TempDir()
	mdFile := filepath.Join(tempDir, "diagram.md")
	mdContent := "# Diagram Test\n\n```mermaid\nflowchart TD\nsubgraph WRITE_PATH[\"WRITE PATH<br/>(direct update)\"]\n    A[form action] --> B[Server Action]\nend\n```\n"
	if err := os.WriteFile(mdFile, []byte(mdContent), 0o644); err != nil {
		t.Fatalf("failed to write diagram markdown: %v", err)
	}

	outPath := filepath.Join(tempDir, "output_diagram.html")
	opts := Options{
		InputPath:      mdFile,
		Export:         true,
		ExportName:     outPath,
		AssetMode:      "cdn",
		FormatMarkdown: false,
	}
	res, err := Run(opts)
	if err != nil {
		t.Fatalf("Run failed for diagram test: %v", err)
	}

	htmlBytes, err := os.ReadFile(res.OutputPath)
	if err != nil {
		t.Fatalf("failed to read diagram HTML output: %v", err)
	}
	html := string(htmlBytes)

	if !strings.Contains(html, "subGraphTitleMargin") {
		t.Errorf("output HTML missing subGraphTitleMargin in bundled JS")
	}
	if !strings.Contains(html, "htmlLabels: false") && !strings.Contains(html, "htmlLabels:false") {
		t.Errorf("output HTML missing htmlLabels: false setting in bundled JS")
	}
}
