// Package main is the entry point for the pdy CLI.
package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	"pdy/internal/pdy"
)

type config struct {
	export     bool
	embed      bool
	noEmbed    bool
	noFmt      bool
	verbose    bool
	assetMode  string
	pandocPath string
	inputPath  string
	exportName string
}

const usageText = `Usage:
  pdy [flags] <input.md>
  pdy -e|--export <input.md> [optional-name]

Flags:
  -e, --export              export instead of preview
      --embed               embed all resources
      --no-embed            do not embed resources (overrides --embed and offline mode)
      --no-fmt              skip source Markdown formatting
      --asset-mode <mode>   cdn (default) or offline
      --pandoc <path>       override the Pandoc binary
      --verbose             print resolved paths and commands
`

func main() {
	if err := run(os.Args[1:], os.Stdout); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			_, _ = io.WriteString(os.Stdout, usageText)
			return
		}
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string, output io.Writer) error {
	cfg, err := parseConfig(args)
	if err != nil {
		return err
	}

	result, err := pdy.Run(pdy.Options{
		InputPath: cfg.inputPath, Export: cfg.export, ExportName: cfg.exportName,
		AssetMode:      cfg.assetMode,
		EmbedResources: cfg.embedResources(),
		FormatMarkdown: !cfg.noFmt, PandocPath: cfg.pandocPath, Verbose: cfg.verbose,
	})
	if err != nil {
		return err
	}
	if cfg.export {
		_, err = fmt.Fprintln(output, result.OutputPath)
	}
	return err
}

func (cfg config) embedResources() bool {
	return !cfg.noEmbed && (cfg.embed || cfg.assetMode == pdy.AssetModeOffline)
}

func parseConfig(args []string) (config, error) {
	var cfg config
	fs := flag.NewFlagSet("pdy", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	fs.BoolVar(&cfg.export, "export", false, "export instead of preview")
	fs.BoolVar(&cfg.export, "e", false, "export instead of preview")
	fs.BoolVar(&cfg.embed, "embed", false, "embed all resources")
	fs.BoolVar(&cfg.noEmbed, "no-embed", false, "do not embed resources")
	fs.BoolVar(&cfg.noFmt, "no-fmt", false, "do not format the source Markdown")
	fs.BoolVar(&cfg.verbose, "verbose", false, "print resolved paths and commands")
	fs.StringVar(&cfg.assetMode, "asset-mode", pdy.AssetModeCDN, "asset loading strategy: cdn or offline")
	fs.StringVar(&cfg.pandocPath, "pandoc", "", "override the Pandoc binary")
	if err := fs.Parse(args); err != nil {
		return cfg, err
	}
	cfg.assetMode = strings.ToLower(cfg.assetMode)
	if cfg.assetMode != pdy.AssetModeCDN && cfg.assetMode != pdy.AssetModeOffline {
		return cfg, fmt.Errorf("invalid --asset-mode %q (expected cdn or offline)", cfg.assetMode)
	}
	rest := fs.Args()
	if len(rest) == 0 {
		return cfg, fmt.Errorf("missing <input.md>\n\n%s", usageText)
	}
	cfg.inputPath = rest[0]
	if cfg.export {
		if len(rest) > 2 {
			return cfg, fmt.Errorf("too many export arguments\n\n%s", usageText)
		}
		if len(rest) == 2 {
			cfg.exportName = rest[1]
		}
	} else if len(rest) > 1 {
		return cfg, fmt.Errorf("unexpected argument %q\n\n%s", rest[1], usageText)
	}
	return cfg, nil
}
