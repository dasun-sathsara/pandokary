// Package pdy provides the rendering and asset preparation pipeline.
package pdy

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	pandokary "pdy"
)

// Options configures a single pdy rendering run.
type Options struct {
	InputPath, ExportName, AssetMode, PandocPath    string
	Export, EmbedResources, FormatMarkdown, Verbose bool
}

// Result contains the output path of a rendering run.
type Result struct{ OutputPath string }

type assetLocation struct {
	dir      string
	cleanup  func()
	writable bool
}

var requiredAssets = []string{"template.html", "inline-assets.lua", "mathjax-config.js", "app.js", "mermaid.js", "base.css", "components/code.css", "themes/manifest.json"}

// Run executes the pandokary rendering pipeline.
func Run(options Options) (Result, error) {
	if options.AssetMode == "" {
		options.AssetMode = "cdn"
	}
	assets, err := resolveAssets()
	if err != nil {
		return Result{}, err
	}
	if assets.cleanup != nil {
		defer assets.cleanup()
	}
	runtimeAssets, cleanup, fontWarnings, err := prepareRuntimeAssets(assets)
	if err != nil {
		return Result{}, fmt.Errorf("prepare runtime assets: %w", err)
	}
	if cleanup != nil {
		defer cleanup()
	}
	for _, warning := range fontWarnings {
		fmt.Fprintf(os.Stderr, "warning: %s\n", warning)
	}

	pandoc, err := findPandoc(options.PandocPath)
	if err != nil {
		return Result{}, err
	}
	if options.FormatMarkdown {
		if err := formatMarkdown(options.InputPath, options.Verbose); err != nil {
			fmt.Fprintf(os.Stderr, "warning: source formatting requested but skipped: %v\n", err)
		}
	} else if options.Verbose {
		fmt.Fprintln(os.Stderr, "source formatting: disabled")
	}

	output, previewDir, err := determineOutput(options)
	if err != nil {
		return Result{}, err
	}
	args := pandocArgs(options, runtimeAssets, output)
	if options.Verbose {
		fmt.Fprintf(os.Stderr, "input: %s\noutput: %s\nassets dir: %s\nsource formatting: %t\npandoc argv: %s\n",
			options.InputPath, output, runtimeAssets, options.FormatMarkdown, strings.Join(quoteArgs(append([]string{pandoc}, args...)), " "))
	}
	if err := runPandoc(pandoc, args, runtimeAssets); err != nil {
		if previewDir != "" {
			_ = os.RemoveAll(previewDir)
		}
		return Result{}, err
	}
	if !options.Export {
		if err := openInBrowser(output); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not open browser automatically: %v\npreview file saved to: %s\n", err, output)
		}
		// A browser opener returns before the browser consumes linked resources. Keep the
		// preview directory for that session; failed/incomplete previews are removed above.
	}
	return Result{OutputPath: output}, nil
}

func resolveAssets() (assetLocation, error) {
	if override := strings.TrimSpace(os.Getenv("PDY_ASSETS_DIR")); override != "" {
		dir, err := filepath.Abs(override)
		if err != nil {
			return assetLocation{}, fmt.Errorf("invalid PDY_ASSETS_DIR: %w", err)
		}
		if err = checkAssets(dir); err != nil {
			return assetLocation{}, fmt.Errorf("invalid PDY_ASSETS_DIR: %w", err)
		}
		return assetLocation{dir: dir}, nil
	}
	if executable, err := os.Executable(); err == nil {
		if resolved, resolveErr := filepath.EvalSymlinks(executable); resolveErr == nil {
			dir := filepath.Join(filepath.Dir(resolved), "assets")
			if checkAssets(dir) == nil {
				return assetLocation{dir: dir}, nil
			}
		}
	}
	if dir, err := findAssetsFromCWD(); err == nil {
		return assetLocation{dir: dir}, nil
	}
	dir, cleanup, err := pandokary.ExtractEmbeddedAssets()
	if err != nil {
		return assetLocation{}, fmt.Errorf("extract embedded assets: %w", err)
	}
	if err = checkAssets(dir); err != nil {
		cleanup()
		return assetLocation{}, err
	}
	return assetLocation{dir: dir, cleanup: cleanup, writable: true}, nil
}

func checkAssets(dir string) error {
	var missing []string
	for _, name := range requiredAssets {
		if info, err := os.Stat(filepath.Join(dir, name)); err != nil || info.IsDir() {
			missing = append(missing, name)
		}
	}
	if len(missing) != 0 {
		return fmt.Errorf("missing required asset(s) in %s: %s", dir, strings.Join(missing, ", "))
	}
	return nil
}

func findAssetsFromCWD() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for i := 0; i < 8; i++ {
		candidate := filepath.Join(dir, "assets")
		if checkAssets(candidate) == nil {
			return candidate, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return "", errors.New("assets not found")
}

func prepareRuntimeAssets(source assetLocation) (string, func(), []string, error) {
	dir := source.dir
	var cleanup func()
	if !source.writable {
		var err error
		dir, err = os.MkdirTemp("", "pdy-runtime-assets-*")
		if err != nil {
			return "", nil, nil, err
		}
		cleanup = func() { _ = os.RemoveAll(dir) }
		if err = copyDir(source.dir, dir); err != nil {
			cleanup()
			return "", nil, nil, err
		}
	}
	warnings, err := writeBundledFontCSS(filepath.Join(dir, "font-assets.css"))
	if err != nil {
		if cleanup != nil {
			cleanup()
		}
		return "", nil, warnings, err
	}
	return dir, cleanup, warnings, nil
}

func copyDir(source, target string) error {
	return filepath.WalkDir(source, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		rel, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		destination := filepath.Join(target, rel)
		if entry.IsDir() {
			return os.MkdirAll(destination, 0o755)
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		input, err := os.Open(path)
		if err != nil {
			return err
		}
		output, err := os.OpenFile(destination, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, info.Mode())
		if err != nil {
			_ = input.Close()
			return err
		}
		_, copyErr := io.Copy(output, input)
		inputErr := input.Close()
		outputErr := output.Close()
		if copyErr != nil {
			return copyErr
		}
		if inputErr != nil {
			return inputErr
		}
		return outputErr
	})
}

type font struct{ family, spec, env, weight, style string }

func writeBundledFontCSS(path string) ([]string, error) {
	staticUprights := []font{
		{"Studio Feixen Sans", "Studio Feixen Sans:style=Regular", "PDY_BODY_FONT_REGULAR", "400", "normal"},
		{"Studio Feixen Sans", "Studio Feixen Sans:style=Medium", "PDY_BODY_FONT_MEDIUM", "500", "normal"},
	}
	fonts := []font{
		{"Studio Feixen Sans", "Studio Feixen Sans:style=Italic", "PDY_BODY_FONT_ITALIC", "400", "italic"},
		{"Studio Feixen Sans", "Studio Feixen Sans:style=Medium Italic", "PDY_BODY_FONT_MEDIUM_ITALIC", "500", "italic"},
		{"Geist Mono", "Geist Mono:style=Regular", "PDY_MONO_FONT_REGULAR", "400", "normal"},
		{"Geist Mono", "Geist Mono:style=Medium", "PDY_MONO_FONT_MEDIUM", "500", "normal"},
	}
	var css strings.Builder
	var warnings []string
	// Upright body text prefers the variable font so intermediate weights
	// (e.g. 570) interpolate instead of snapping to the nearest static.
	// Machines without it fall back to the Regular/Medium statics, where
	// 570 renders as 500.
	if vfPath, err := resolveBodyVariableFont(); err == nil {
		if embedErr := embedFont(&css, "Studio Feixen Sans", "normal", "100 900", vfPath); embedErr != nil {
			warnings = append(warnings, fmt.Sprintf("variable body font %q could not be read: %v; using static fallback", vfPath, embedErr))
			fonts = append(staticUprights, fonts...)
		}
	} else {
		fonts = append(staticUprights, fonts...)
	}
	for _, item := range fonts {
		fontPath, err := resolveFont(item.env, item.spec)
		if err != nil {
			warnings = append(warnings, fmt.Sprintf("font %q unavailable: %v; using CSS fallback", item.spec, err))
			continue
		}
		if err := embedFont(&css, item.family, item.style, item.weight, fontPath); err != nil {
			warnings = append(warnings, fmt.Sprintf("font %q could not be read: %v; using CSS fallback", fontPath, err))
		}
	}
	return warnings, os.WriteFile(path, []byte(css.String()), 0o644)
}

// embedFont appends an @font-face rule with the file at fontPath inlined.
func embedFont(css *strings.Builder, family, style, weight, fontPath string) error {
	data, err := os.ReadFile(fontPath)
	if err != nil {
		return err
	}
	fmt.Fprintf(css, "@font-face{font-family:%q;font-style:%s;font-weight:%s;font-display:swap;src:url(\"data:%s;base64,%s\") format(\"%s\");}\n", family, style, weight, fontMIME(fontPath), base64.StdEncoding.EncodeToString(data), fontFormat(fontPath))
	return nil
}

// resolveBodyVariableFont locates the Studio Feixen Sans variable font, if
// installed. PDY_BODY_FONT_VF overrides; otherwise fontconfig is asked for a
// variable-flagged file in the family.
func resolveBodyVariableFont() (string, error) {
	if override := strings.TrimSpace(os.Getenv("PDY_BODY_FONT_VF")); override != "" {
		if info, err := os.Stat(override); err == nil && !info.IsDir() {
			return override, nil
		}
		return "", fmt.Errorf("PDY_BODY_FONT_VF points to an invalid file: %s", override)
	}
	lister, err := exec.LookPath("fc-list")
	if err != nil {
		return "", errors.New("fc-list not installed")
	}
	out, err := exec.Command(lister, "Studio Feixen Sans", "file", "variable").CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("fc-list: %s", strings.TrimSpace(string(out)))
	}
	for _, line := range strings.Split(string(out), "\n") {
		file, flag, ok := strings.Cut(line, ": :variable=")
		if !ok {
			continue
		}
		file = strings.TrimSpace(file)
		if strings.TrimSpace(flag) != "True" || file == "" {
			continue
		}
		if info, err := os.Stat(file); err == nil && !info.IsDir() {
			return file, nil
		}
	}
	return "", errors.New("no variable Studio Feixen Sans installed")
}

func resolveFont(env, spec string) (string, error) {
	if override := strings.TrimSpace(os.Getenv(env)); override != "" {
		if info, err := os.Stat(override); err == nil && !info.IsDir() {
			return override, nil
		}
		return "", fmt.Errorf("%s points to an invalid file: %s", env, override)
	}
	if strings.HasPrefix(env, "PDY_BODY_FONT_") {
		for _, fallbackEnv := range []string{"PDY_BODY_FONT", "PDY_BODY_FONT_REGULAR"} {
			if override := strings.TrimSpace(os.Getenv(fallbackEnv)); override != "" {
				if info, err := os.Stat(override); err == nil && !info.IsDir() {
					return override, nil
				}
			}
		}
	}
	if strings.HasPrefix(env, "PDY_MONO_FONT_") {
		for _, fallbackEnv := range []string{"PDY_MONO_FONT", "PDY_MONO_FONT_MEDIUM", "PDY_MONO_FONT_REGULAR"} {
			if override := strings.TrimSpace(os.Getenv(fallbackEnv)); override != "" {
				if info, err := os.Stat(override); err == nil && !info.IsDir() {
					return override, nil
				}
			}
		}
	}
	matcher, err := exec.LookPath("fc-match")
	if err != nil {
		return "", errors.New("fc-match not installed")
	}
	out, err := exec.Command(matcher, "-f", "%{file}", spec).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("fc-match: %s", strings.TrimSpace(string(out)))
	}
	path := strings.TrimSpace(string(out))
	info, statErr := os.Stat(path)
	if path == "" || statErr != nil || info.IsDir() {
		return "", errors.New("no usable matching font file")
	}
	return path, nil
}
func fontMIME(path string) string {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".otf":
		return "font/otf"
	case ".woff":
		return "font/woff"
	case ".woff2":
		return "font/woff2"
	default:
		return "font/ttf"
	}
}
func fontFormat(path string) string {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".otf":
		return "opentype"
	case ".woff":
		return "woff"
	case ".woff2":
		return "woff2"
	default:
		return "truetype"
	}
}

func findPandoc(override string) (string, error) {
	if override == "" {
		if path, err := exec.LookPath("pandoc"); err == nil {
			return path, nil
		}
		return "", errors.New("pandoc not found (install Pandoc or pass --pandoc <path>)")
	}
	if path, err := exec.LookPath(override); err == nil {
		return path, nil
	}
	path, _ := filepath.Abs(override)
	if info, err := os.Stat(path); err == nil && !info.IsDir() {
		return path, nil
	}
	return "", fmt.Errorf("pandoc not found: %s", override)
}

func formatMarkdown(input string, verbose bool) error {
	binary, err := exec.LookPath("dprint")
	if err != nil {
		return fmt.Errorf("dprint not found: %w", err)
	}
	source, err := os.ReadFile(input)
	if err != nil {
		return err
	}
	cmd := exec.Command(binary, "fmt", "--stdin", input)
	cmd.Stdin = bytes.NewReader(source)
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	if err = cmd.Run(); err != nil {
		return fmt.Errorf("dprint failed: %s: %w", strings.TrimSpace(stderr.String()), err)
	}
	if stdout.Len() != 0 && !bytes.Equal(source, stdout.Bytes()) {
		mode := os.FileMode(0o644)
		if info, statErr := os.Stat(input); statErr == nil {
			mode = info.Mode()
		}
		dir := filepath.Dir(input)
		tmpFile, tmpErr := os.CreateTemp(dir, ".pdy-fmt-*")
		if tmpErr != nil {
			return tmpErr
		}
		tmpPath := tmpFile.Name()
		if _, writeErr := tmpFile.Write(stdout.Bytes()); writeErr != nil {
			_ = tmpFile.Close()
			_ = os.Remove(tmpPath)
			return writeErr
		}
		if closeErr := tmpFile.Close(); closeErr != nil {
			_ = os.Remove(tmpPath)
			return closeErr
		}
		if chmodErr := os.Chmod(tmpPath, mode); chmodErr != nil {
			_ = os.Remove(tmpPath)
			return chmodErr
		}
		if renameErr := os.Rename(tmpPath, input); renameErr != nil {
			_ = os.Remove(tmpPath)
			return renameErr
		}
		if verbose {
			fmt.Fprintf(os.Stderr, "formatted source Markdown: %s\n", input)
		}
	} else if verbose {
		fmt.Fprintln(os.Stderr, "source Markdown already formatted")
	}
	return nil
}

func determineOutput(options Options) (string, string, error) {
	base := strings.TrimSuffix(filepath.Base(options.InputPath), filepath.Ext(options.InputPath))
	if options.Export {
		name := options.ExportName
		if name == "" {
			name = base
		}
		if strings.ToLower(filepath.Ext(name)) != ".html" {
			name += ".html"
		}
		if filepath.IsAbs(name) {
			return filepath.Clean(name), "", nil
		}
		cwd, err := os.Getwd()
		if err != nil {
			return "", "", err
		}
		return filepath.Join(cwd, name), "", nil
	}
	dir, err := os.MkdirTemp("", "pdy-preview-*")
	if err != nil {
		return "", "", err
	}
	return filepath.Join(dir, base+".html"), dir, nil
}

func pandocArgs(options Options, assets, output string) []string {
	resourcePath := filepath.Dir(options.InputPath) + string(os.PathListSeparator) + assets
	args := []string{"--from", "markdown+tex_math_dollars+tex_math_single_backslash", options.InputPath, "--template", filepath.Join(assets, "template.html"), "--standalone", "--resource-path", resourcePath, "--syntax-highlighting=none", "--mathjax", "--lua-filter", filepath.Join(assets, "inline-assets.lua"), "--metadata=assetMode:" + options.AssetMode}
	if sourceDir, err := filepath.Abs(filepath.Dir(options.InputPath)); err == nil && !options.EmbedResources {
		sourcePath := filepath.ToSlash(sourceDir)
		base := url.URL{Scheme: "file"}
		if strings.HasPrefix(sourcePath, "//") {
			parts := strings.SplitN(strings.TrimPrefix(sourcePath, "//"), "/", 2)
			base.Host = parts[0]
			sourcePath = "/"
			if len(parts) > 1 {
				sourcePath += parts[1]
			}
		} else if !strings.HasPrefix(sourcePath, "/") {
			sourcePath = "/" + sourcePath
		}
		base.Path = strings.TrimSuffix(sourcePath, "/") + "/"
		args = append(args, "--metadata=pdyResourceBase:"+base.String())
	}
	if options.AssetMode == "cdn" {
		args = append(args, "--metadata=assetModeCdn:true")
	} else {
		args = append(args, "--metadata=assetModeOffline:true")
	}
	if options.EmbedResources {
		args = append(args, "--embed-resources")
	}
	return append(args, "--output", output)
}

func runPandoc(binary string, args []string, assets string) error {
	cmd := exec.Command(binary, args...)
	cmd.Env = append(os.Environ(), "PDY_ASSETS_DIR="+assets)
	cmd.Stdout = os.Stdout
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		message := strings.TrimSpace(stderr.String())
		if message == "" {
			message = err.Error()
		}
		var exit *exec.ExitError
		if errors.As(err, &exit) {
			return fmt.Errorf("pandoc exited with code %d: %s", exit.ExitCode(), message)
		}
		return fmt.Errorf("run pandoc: %w: %s", err, message)
	}
	return nil
}

func openInBrowser(path string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", path)
	case "linux":
		cmd = exec.Command("xdg-open", path)
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", "", path)
	default:
		return fmt.Errorf("unsupported platform %s", runtime.GOOS)
	}
	return cmd.Run()
}
func quoteArgs(args []string) []string {
	for i, arg := range args {
		if strings.ContainsAny(arg, " \t\n\"'\\") {
			args[i] = fmt.Sprintf("%q", arg)
		}
	}
	return args
}
