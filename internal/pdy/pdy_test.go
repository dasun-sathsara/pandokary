package pdy

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestWriteBundledFontCSS(t *testing.T) {
	tempDir := t.TempDir()
	fontFile := filepath.Join(tempDir, "mock-font.ttf")
	if err := os.WriteFile(fontFile, []byte("mock ttf content"), 0o644); err != nil {
		t.Fatalf("failed to create mock font: %v", err)
	}

	t.Setenv("PDY_BODY_FONT_REGULAR", fontFile)
	t.Setenv("PDY_BODY_FONT_MEDIUM", fontFile)
	t.Setenv("PDY_BODY_FONT_SEMIBOLD", fontFile)
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
	if !strings.Contains(cssStr, "Studio Feixen Sans TRIAL") {
		t.Errorf("font-assets.css does not contain Studio Feixen Sans TRIAL, got: %s", cssStr)
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

			// Studio Feixen Sans TRIAL @font-face must be present in the inline style of both modes
			if !strings.Contains(html, "Studio Feixen Sans TRIAL") {
				t.Errorf("Mode %s: output HTML missing 'Studio Feixen Sans TRIAL'", mode)
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
