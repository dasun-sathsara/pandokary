// Package main is the entry point for the pdy CLI.
package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"pdy/internal/pdy"
)

type config struct {
	export, embed, noEmbed, noFmt, verbose bool
	assetMode, pandocPath                  string
	inputPath, exportName                  string
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
	input, err := filepath.Abs(cfg.inputPath)
	if err != nil {
		exit(fmt.Errorf("resolve input path: %w", err))
	}
	info, err := os.Stat(input)
	if err != nil {
		exit(fmt.Errorf("input file %q: %w", input, err))
	}
	if info.IsDir() {
		exit(fmt.Errorf("input path is a directory: %s", input))
	}

	result, err := pdy.Run(pdy.Options{
		InputPath: input, Export: cfg.export, ExportName: cfg.exportName,
		AssetMode:      cfg.assetMode,
		EmbedResources: cfg.embedResources(),
		FormatMarkdown: !cfg.noFmt, PandocPath: cfg.pandocPath, Verbose: cfg.verbose,
	})
	if err != nil {
		exit(err)
	}
	if cfg.export {
		fmt.Println(result.OutputPath)
	}
}

func (cfg config) embedResources() bool {
	return !cfg.noEmbed && (cfg.embed || cfg.assetMode == "offline")
}

func exit(err error) { fmt.Fprintln(os.Stderr, err); os.Exit(1) }

func parseConfig(args []string) (config, error) {
	var cfg config
	fs := flag.NewFlagSet("pdy", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	fs.BoolVar(&cfg.export, "export", false, "export instead of preview")
	fs.BoolVar(&cfg.embed, "embed", false, "embed all resources")
	fs.BoolVar(&cfg.noEmbed, "no-embed", false, "do not embed resources")
	fs.BoolVar(&cfg.noFmt, "no-fmt", false, "do not format the source Markdown")
	fs.BoolVar(&cfg.verbose, "verbose", false, "print resolved paths and commands")
	fs.StringVar(&cfg.assetMode, "asset-mode", "cdn", "asset loading strategy: cdn or offline")
	fs.StringVar(&cfg.pandocPath, "pandoc", "", "override the Pandoc binary")
	if err := fs.Parse(rewriteAliases(args)); err != nil {
		return cfg, err
	}
	cfg.assetMode = strings.ToLower(cfg.assetMode)
	if cfg.assetMode != "cdn" && cfg.assetMode != "offline" {
		return cfg, fmt.Errorf("invalid --asset-mode %q (expected cdn or offline)", cfg.assetMode)
	}
	rest := fs.Args()
	if len(rest) == 0 {
		return cfg, fmt.Errorf("missing <input.md>\n\n%s", usageSynopsis())
	}
	cfg.inputPath = rest[0]
	if cfg.export {
		if len(rest) > 2 {
			return cfg, fmt.Errorf("too many export arguments\n\n%s", usageSynopsis())
		}
		if len(rest) == 2 {
			cfg.exportName = rest[1]
		}
	} else if len(rest) > 1 {
		return cfg, fmt.Errorf("unexpected argument %q\n\n%s", rest[1], usageSynopsis())
	}
	return cfg, nil
}

func rewriteAliases(args []string) []string {
	out := append([]string(nil), args...)
	for i := range out {
		if out[i] == "-e" {
			out[i] = "--export"
		}
	}
	return out
}

func usageSynopsis() string { var b strings.Builder; printUsage(&b); return b.String() }
func printUsage(w io.Writer) {
	_, _ = fmt.Fprintln(w, "Usage:\n  pdy [flags] <input.md>\n  pdy -e|--export <input.md> [optional-name]\n\nFlags:")
	_, _ = fmt.Fprintln(w, "  -e, --export              export instead of preview")
	_, _ = fmt.Fprintln(w, "      --embed               embed all resources")
	_, _ = fmt.Fprintln(w, "      --no-embed            do not embed resources (overrides --embed and offline mode)")
	_, _ = fmt.Fprintln(w, "      --no-fmt              skip source Markdown formatting")
	_, _ = fmt.Fprintln(w, "      --asset-mode <mode>   cdn (default) or offline")
	_, _ = fmt.Fprintln(w, "      --pandoc <path>       override the Pandoc binary")
	_, _ = fmt.Fprintln(w, "      --verbose             print resolved paths and commands")
}
