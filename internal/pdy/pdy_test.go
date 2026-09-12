package pdy

import (
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
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
				for _, theme := range []string{"lumina", "parchment", "obsidian", "midnight-fjord"} {
					if !strings.Contains(html, `[data-theme="`+theme+`"]`) {
						t.Errorf("missing theme %s", theme)
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

func TestWriteBundledFontCSS(t *testing.T) {
	tempDir := t.TempDir()
	fontFile := filepath.Join(tempDir, "mock-font.ttf")
	if err := os.WriteFile(fontFile, []byte("mock ttf content"), 0o644); err != nil {
		t.Fatalf("failed to create mock font: %v", err)
	}

	t.Setenv("PDY_BODY_FONT_REGULAR", fontFile)
	t.Setenv("PDY_BODY_FONT_MEDIUM", fontFile)
	t.Setenv("PDY_BODY_FONT_ITALIC", fontFile)
	t.Setenv("PDY_BODY_FONT_MEDIUM_ITALIC", fontFile)
	t.Setenv("PDY_MONO_FONT_MEDIUM", fontFile)

	cssPath := filepath.Join(tempDir, "font-assets.css")
	warnings, err := writeBundledFontCSS(cssPath)
	if err != nil {
		t.Fatalf("writeBundledFontCSS failed: %v", err)
	}
	if len(warnings) != 0 {
		t.Logf("warnings during writeBundledFontCSS: %v", warnings)
	}

	content, err := os.ReadFile(cssPath)
	if err != nil {
		t.Fatalf("failed to read font-assets.css: %v", err)
	}

	cssStr := string(content)
	if !strings.Contains(cssStr, "Studio Feixen Sans") {
		t.Errorf("font-assets.css does not contain Studio Feixen Sans, got: %s", cssStr)
	}
	if !strings.Contains(cssStr, "@font-face") {
		t.Errorf("font-assets.css does not contain @font-face, got: %s", cssStr)
	}
}

func TestFontAssetsBundledInCDNAndOfflineModes(t *testing.T) {
	tempDir := t.TempDir()

	// Create mock font file and set env vars to ensure font-assets.css is populated
	fontFile := filepath.Join(tempDir, "mock-font.ttf")
	if err := os.WriteFile(fontFile, []byte("dummy font data"), 0o644); err != nil {
		t.Fatalf("failed to write mock font: %v", err)
	}
	t.Setenv("PDY_BODY_FONT_REGULAR", fontFile)

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

			// Studio Feixen Sans @font-face must be present in the inline style of both modes
			if !strings.Contains(html, "Studio Feixen Sans") {
				t.Errorf("Mode %s: output HTML missing 'Studio Feixen Sans'", mode)
			}
		})
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
