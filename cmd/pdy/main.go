package main

import (
	"bytes"
	"encoding/base64"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	pandokary "pdy"
)

type config struct {
	export     bool
	noEmbed    bool
	assetMode  string
	pandocPath string
	verbose    bool
	inputPath  string
	exportName string
}

func main() {
	cfg, err := parseConfig(os.Args[1:])
	if err != nil {
		if errors.Is(err, flag.ErrHelp) {
			printUsage(os.Stdout)
			return
		}
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	inputAbs, err := filepath.Abs(cfg.inputPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to resolve input path: %v\n", err)
		os.Exit(1)
	}
	if _, err := os.Stat(inputAbs); err != nil {
		if os.IsNotExist(err) {
			fmt.Fprintf(os.Stderr, "input file not found: %s\n", inputAbs)
		} else {
			fmt.Fprintf(os.Stderr, "failed to stat input file: %v\n", err)
		}
		os.Exit(1)
	}

	exeDir, err := resolveExeDir()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to resolve executable directory: %v\n", err)
		os.Exit(1)
	}
	baseAssetsDir, cleanupAssets, err := resolveAssetsDir(exeDir)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if cleanupAssets != nil {
		defer cleanupAssets()
	}
	assetsDir, cleanupRuntimeAssets, err := prepareRuntimeAssets(baseAssetsDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to prepare runtime assets: %v\n", err)
		os.Exit(1)
	}
	defer cleanupRuntimeAssets()

	pandocBin, err := findPandoc(cfg.pandocPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	inputDir := filepath.Dir(inputAbs)
	outputPath, err := determineOutput(cfg, inputAbs)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	resourcePath := buildResourcePath(inputDir, assetsDir)
	templatePath := filepath.Join(assetsDir, "template.html")
	cssPath := filepath.Join(assetsDir, "styles.css")
	luaFilterPath := filepath.Join(assetsDir, "inline-assets.lua")

	shouldEmbed := cfg.assetMode == "offline" && !cfg.noEmbed
	args := buildPandocArgs(inputAbs, templatePath, cssPath, resourcePath, luaFilterPath, outputPath, cfg.assetMode, shouldEmbed)

	if cfg.verbose {
		printVerboseInfo(pandocBin, inputAbs, outputPath, exeDir, assetsDir, resourcePath, args, cfg.assetMode, shouldEmbed)
	}

	if err := runPandoc(pandocBin, args, assetsDir); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	if cfg.export {
		fmt.Println(outputPath)
		return
	}

	if err := openInBrowser(outputPath); err != nil {
		fmt.Fprintf(os.Stderr, "failed to open browser: %v\n", err)
		os.Exit(1)
	}
}

func parseConfig(rawArgs []string) (config, error) {
	var cfg config
	args := rewriteAliases(rawArgs)
	fs := flag.NewFlagSet("pdy", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	fs.BoolVar(&cfg.export, "export", false, "export to current directory instead of previewing")
	fs.BoolVar(&cfg.noEmbed, "no-embed", false, "disable resource embedding")
	fs.StringVar(&cfg.assetMode, "asset-mode", "cdn", "asset loading strategy: offline or cdn")
	fs.StringVar(&cfg.pandocPath, "pandoc", "", "override pandoc binary path")
	fs.BoolVar(&cfg.verbose, "verbose", false, "print resolved paths and pandoc argv")

	if err := fs.Parse(args); err != nil {
		return cfg, err
	}

	cfg.assetMode = strings.ToLower(cfg.assetMode)
	switch cfg.assetMode {
	case "offline", "cdn":
	default:
		return cfg, fmt.Errorf("invalid --asset-mode %q (expected offline or cdn)", cfg.assetMode)
	}

	remaining := fs.Args()
	if len(remaining) == 0 {
		return cfg, fmt.Errorf("usage error: missing <input.md>\n\n%s", usageSynopsis())
	}

	cfg.inputPath = remaining[0]

	if cfg.export {
		if len(remaining) > 2 {
			return cfg, fmt.Errorf("usage error: too many arguments for export\n\n%s", usageSynopsis())
		}
		if len(remaining) == 2 {
			cfg.exportName = remaining[1]
		}
	} else if len(remaining) > 1 {
		return cfg, fmt.Errorf("usage error: unexpected extra argument %q\n\n%s", remaining[1], usageSynopsis())
	}

	return cfg, nil
}

func rewriteAliases(args []string) []string {
	if len(args) == 0 {
		return args
	}
	out := make([]string, 0, len(args))
	for _, arg := range args {
		if arg == "-e" {
			out = append(out, "--export")
			continue
		}
		out = append(out, arg)
	}
	return out
}

func usageSynopsis() string {
	var b strings.Builder
	printUsage(&b)
	return b.String()
}

func printUsage(w io.Writer) {
	fmt.Fprintln(w, "Usage:")
	fmt.Fprintln(w, "  pdy [flags] <input.md>")
	fmt.Fprintln(w, "  pdy -e|--export <input.md> [optional-name]")
	fmt.Fprintln(w)
	fmt.Fprintln(w, "Flags:")
	fmt.Fprintln(w, "  -e, --export     export to current directory instead of previewing")
	fmt.Fprintln(w, "      --no-embed   disable resource embedding")
	fmt.Fprintln(w, "      --asset-mode <offline|cdn>  choose asset loading strategy (default: cdn)")
	fmt.Fprintln(w, "      --pandoc     override pandoc binary path")
	fmt.Fprintln(w, "      --verbose    print resolved paths and pandoc argv")
}

func resolveExeDir() (string, error) {
	exePath, err := os.Executable()
	if err != nil {
		return "", err
	}
	resolved, err := filepath.EvalSymlinks(exePath)
	if err != nil {
		return "", err
	}
	return filepath.Dir(resolved), nil
}

func resolveAssetsDir(exeDir string) (string, func(), error) {
	if override := strings.TrimSpace(os.Getenv("PDY_ASSETS_DIR")); override != "" {
		overrideAbs, err := filepath.Abs(override)
		if err != nil {
			return "", nil, fmt.Errorf("invalid PDY_ASSETS_DIR %q: %v", override, err)
		}
		if err := checkAssets(overrideAbs); err != nil {
			return "", nil, fmt.Errorf("PDY_ASSETS_DIR is set but invalid: %v", err)
		}
		return overrideAbs, nil, nil
	}

	// 1) Adjacent to the executable (release builds via `make build`).
	assetsNextToExe := filepath.Join(exeDir, "assets")
	if err := checkAssets(assetsNextToExe); err == nil {
		return assetsNextToExe, nil, nil
	}

	// 2) Somewhere above the current working directory (developer workflows like `go run`).
	if fromCwd, err := findAssetsFromCwd(); err == nil {
		return fromCwd, nil, nil
	}

	// 3) Embedded assets fallback (works for `go install` and Homebrew-style installs).
	dir, cleanup, err := pandokary.ExtractEmbeddedAssets()
	if err != nil {
		return "", nil, fmt.Errorf("failed to prepare embedded assets: %v", err)
	}
	if err := checkAssets(dir); err != nil {
		cleanup()
		return "", nil, fmt.Errorf("embedded assets are incomplete: %v", err)
	}
	return dir, cleanup, nil
}

func prepareRuntimeAssets(sourceDir string) (string, func(), error) {
	dir, err := os.MkdirTemp("", "pdy-runtime-assets-*")
	if err != nil {
		return "", nil, err
	}
	cleanup := func() {
		_ = os.RemoveAll(dir)
	}
	if err := copyDir(sourceDir, dir); err != nil {
		cleanup()
		return "", nil, err
	}
	if err := writeBundledFontCSS(filepath.Join(dir, "font-assets.css")); err != nil {
		cleanup()
		return "", nil, err
	}
	return dir, cleanup, nil
}

func copyDir(sourceDir, targetDir string) error {
	return filepath.WalkDir(sourceDir, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(sourceDir, path)
		if err != nil {
			return err
		}
		target := filepath.Join(targetDir, rel)
		if entry.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		input, err := os.Open(path)
		if err != nil {
			return err
		}
		defer input.Close()
		output, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, info.Mode())
		if err != nil {
			return err
		}
		defer output.Close()
		_, err = io.Copy(output, input)
		return err
	})
}

type bundledFont struct {
	family string
	spec   string
	env    string
	weight string
	style  string
}

func writeBundledFontCSS(path string) error {
	fonts := []bundledFont{
		{
			family: "Studio Feixen Sans TRIAL",
			spec:   "Studio Feixen Sans TRIAL:style=Regular",
			env:    "PDY_BODY_FONT_REGULAR",
			weight: "400",
			style:  "normal",
		},
		{
			family: "Studio Feixen Sans TRIAL",
			spec:   "Studio Feixen Sans TRIAL:style=Semibold",
			env:    "PDY_BODY_FONT_SEMIBOLD",
			weight: "600",
			style:  "normal",
		},
		{
			family: "Studio Feixen Serif Trial",
			spec:   "Studio Feixen Serif Trial:style=Regular",
			env:    "PDY_SERIF_FONT_REGULAR",
			weight: "400",
			style:  "normal",
		},
		{
			family: "Studio Feixen Serif Trial",
			spec:   "Studio Feixen Serif Trial:style=Bold",
			env:    "PDY_SERIF_FONT_SEMIBOLD",
			weight: "600",
			style:  "normal",
		},
		{
			family: "VictorMono Nerd Font Propo",
			spec:   "VictorMono Nerd Font Propo:style=Medium",
			env:    "PDY_MONO_FONT_MEDIUM",
			weight: "500",
			style:  "normal",
		},
	}

	var css strings.Builder
	for _, font := range fonts {
		fontPath, err := resolveFontFile(font.env, font.spec)
		if err != nil {
			continue
		}
		data, err := os.ReadFile(fontPath)
		if err != nil {
			continue
		}
		css.WriteString("@font-face {\n")
		css.WriteString(fmt.Sprintf("\tfont-family: %q;\n", font.family))
		css.WriteString(fmt.Sprintf("\tfont-style: %s;\n", font.style))
		css.WriteString(fmt.Sprintf("\tfont-weight: %s;\n", font.weight))
		css.WriteString("\tfont-display: swap;\n")
		css.WriteString(fmt.Sprintf("\tsrc: url(\"data:%s;base64,%s\") format(\"%s\");\n", fontMimeType(fontPath), base64.StdEncoding.EncodeToString(data), fontFormat(fontPath)))
		css.WriteString("}\n\n")
	}
	return os.WriteFile(path, []byte(css.String()), 0o644)
}

func resolveFontFile(envName, fontSpec string) (string, error) {
	if override := strings.TrimSpace(os.Getenv(envName)); override != "" {
		if info, err := os.Stat(override); err == nil && !info.IsDir() {
			return override, nil
		}
	}
	path, err := exec.Command("fc-match", "-f", "%{file}", fontSpec).Output()
	if err != nil {
		return "", err
	}
	resolved := strings.TrimSpace(string(path))
	if resolved == "" {
		return "", fmt.Errorf("font not found: %s", fontSpec)
	}
	if info, err := os.Stat(resolved); err != nil || info.IsDir() {
		return "", fmt.Errorf("font path is invalid: %s", resolved)
	}
	return resolved, nil
}

func fontMimeType(path string) string {
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

func findAssetsFromCwd() (string, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	dir := cwd
	for i := 0; i < 6; i++ {
		candidate := filepath.Join(dir, "assets")
		if err := checkAssets(candidate); err == nil {
			return candidate, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return "", fmt.Errorf("assets not found near working directory %s", cwd)
}

func checkAssets(assetsDir string) error {
	required := []string{
		"template.html",
		"styles.css",
		"inline-assets.lua",
		"mathjax-config.js",
		"script.js",
	}
	var missing []string
	for _, name := range required {
		path := filepath.Join(assetsDir, name)
		if info, err := os.Stat(path); err != nil || info.IsDir() {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		return fmt.Errorf("missing required asset(s) in %s: %s", assetsDir, strings.Join(missing, ", "))
	}
	return nil
}

func findPandoc(pathFlag string) (string, error) {
	if pathFlag != "" {
		resolved := pathFlag
		if !filepath.IsAbs(pathFlag) {
			if lp, err := exec.LookPath(pathFlag); err == nil {
				resolved = lp
			} else {
				abs, absErr := filepath.Abs(pathFlag)
				if absErr != nil {
					return "", fmt.Errorf("pandoc not found (install Pandoc or pass --pandoc <path>)")
				}
				resolved = abs
			}
		}
		if info, err := os.Stat(resolved); err != nil || info.IsDir() {
			return "", fmt.Errorf("pandoc not found (install Pandoc or pass --pandoc <path>)")
		}
		return resolved, nil
	}

	bin, err := exec.LookPath("pandoc")
	if err != nil {
		return "", fmt.Errorf("pandoc not found (install Pandoc or pass --pandoc <path>)")
	}
	return bin, nil
}

func determineOutput(cfg config, inputAbs string) (string, error) {
	inputBase := strings.TrimSuffix(filepath.Base(inputAbs), filepath.Ext(inputAbs))
	if cfg.export {
		cwd, err := os.Getwd()
		if err != nil {
			return "", fmt.Errorf("failed to resolve working directory: %v", err)
		}
		name := cfg.exportName
		if name == "" {
			name = inputBase
		}
		if filepath.Ext(name) == "" {
			name += ".html"
		} else if strings.ToLower(filepath.Ext(name)) != ".html" {
			name += ".html"
		}
		output := filepath.Join(cwd, name)
		return output, nil
	}

	tempDir, err := os.MkdirTemp("", "pdy-*")
	if err != nil {
		return "", fmt.Errorf("failed to create temporary directory: %v", err)
	}
	output := filepath.Join(tempDir, inputBase+".html")
	return output, nil
}

func buildResourcePath(inputDir, assetsDir string) string {
	return inputDir + string(os.PathListSeparator) + assetsDir
}

func buildPandocArgs(inputAbs, templatePath, cssPath, resourcePath, luaFilterPath, outputPath, assetMode string, embed bool) []string {
	args := []string{
		"--from", "markdown+tex_math_dollars+tex_math_single_backslash",
		inputAbs,
		"--template", templatePath,
		"--standalone",
		"--css", cssPath,
		"--resource-path", resourcePath,
		"--syntax-highlighting=none",
		"--mathjax",
		"--lua-filter", luaFilterPath,
	}
	args = append(args, "--metadata=assetMode:"+assetMode)
	switch assetMode {
	case "cdn":
		args = append(args, "--metadata=assetModeCdn:true")
	case "offline":
		args = append(args, "--metadata=assetModeOffline:true")
	}
	if embed {
		args = append(args, "--embed-resources")
	}
	args = append(args, "--output", outputPath)
	return args
}

func runPandoc(bin string, args []string, assetsDir string) error {
	cmd := exec.Command(bin, args...)
	cmd.Env = append(os.Environ(), "PDY_ASSETS_DIR="+assetsDir)
	cmd.Stdout = os.Stdout
	var stderr bytes.Buffer
	cmd.Stderr = io.MultiWriter(os.Stderr, &stderr)

	if err := cmd.Run(); err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			return fmt.Errorf("pandoc exited with code %d", exitErr.ExitCode())
		}
		return err
	}
	return nil
}

func openInBrowser(htmlPath string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", htmlPath)
	case "linux":
		cmd = exec.Command("xdg-open", htmlPath)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", htmlPath)
	default:
		return fmt.Errorf("unsupported platform %q", runtime.GOOS)
	}
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func printVerboseInfo(pandocBin, inputAbs, outputPath, exeDir, assetsDir, resourcePath string, args []string, assetMode string, embed bool) {
	fmt.Printf("input: %s\n", inputAbs)
	fmt.Printf("output: %s\n", outputPath)
	fmt.Printf("executable dir: %s\n", exeDir)
	fmt.Printf("assets dir: %s\n", assetsDir)
	fmt.Printf("resource-path: %s\n", resourcePath)
	argv := append([]string{pandocBin}, args...)
	fmt.Printf("pandoc argv: %s\n", strings.Join(shellQuoteArgs(argv), " "))
	fmt.Printf("asset mode: %s\n", assetMode)
	if embed {
		fmt.Println("embed resources: on")
	} else {
		fmt.Println("embed resources: off")
	}
}

func shellQuoteArgs(args []string) []string {
	out := make([]string, len(args))
	for i, arg := range args {
		if len(arg) == 0 {
			out[i] = "''"
			continue
		}
		if strings.ContainsAny(arg, " \t\n\"'\\") {
			out[i] = fmt.Sprintf("%q", arg)
			continue
		}
		out[i] = arg
	}
	return out
}
